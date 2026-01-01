const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const net = require('net');

let mainWindow;
let backendProcess;
let backendPort = 5690;
let isShuttingDown = false;
const isDev = process.env.NODE_ENV === 'development';

// Enhanced backend health check with retry mechanism
async function isBackendRunning(retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const isRunning = await checkBackendHealth();
      if (isRunning) return true;
      
      if (i < retries - 1) {
        console.log(`Backend check ${i + 1}/${retries} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      console.error(`Backend health check attempt ${i + 1} failed:`, error.message);
    }
  }
  return false;
}

function checkBackendHealth() {
  return new Promise((resolve) => {
    const http = require('http');
    const req = http.request({
      hostname: '127.0.0.1',
      port: backendPort,
      path: '/api/health/simple',
      method: 'GET',
      timeout: 3000
    }, (res) => {
      console.log(`Backend health check: HTTP ${res.statusCode}`);
      resolve(res.statusCode === 200);
    });
    
    req.on('error', (err) => {
      console.log('Backend health check failed:', err.code);
      resolve(false);
    });
    
    req.on('timeout', () => {
      console.log('Backend health check timeout');
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

// Check if port is available
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.listen(port, () => {
      server.once('close', () => resolve(true));
      server.close();
    });
    
    server.on('error', () => resolve(false));
  });
}

// Enhanced port killing function
function killProcessByPort(port) {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    
    if (isWindows) {
      // Windows: Find and kill process using port
      exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
        if (!error && stdout) {
          const lines = stdout.split('\n');
          const pids = new Set();
          
          lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 5 && parts[1].includes(`:${port}`)) {
              pids.add(parts[4]);
            }
          });
          
          if (pids.size > 0) {
            console.log(`Killing processes on port ${port}:`, Array.from(pids));
            let killedCount = 0;
            pids.forEach(pid => {
              exec(`taskkill /PID ${pid} /F /T`, (err) => {
                killedCount++;
                if (err) {
                  console.error(`Failed to kill PID ${pid}:`, err.message);
                }
                if (killedCount === pids.size) {
                  setTimeout(resolve, 1000); // Wait a bit after killing
                }
              });
            });
          } else {
            resolve();
          }
        } else {
          resolve();
        }
      });
    } else {
      // Unix/Linux/Mac: Find and kill process
      exec(`lsof -ti:${port}`, (error, stdout) => {
        if (!error && stdout) {
          const pids = stdout.trim().split('\n').filter(pid => pid);
          console.log(`Killing processes on port ${port}:`, pids);
          
          let killedCount = 0;
          pids.forEach(pid => {
            exec(`kill -9 ${pid}`, (err) => {
              killedCount++;
              if (err) {
                console.error(`Failed to kill PID ${pid}:`, err.message);
              }
              if (killedCount === pids.size) {
                setTimeout(resolve, 1000); // Wait a bit after killing
              }
            });
          });
        } else {
          resolve();
        }
      });
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 800,
    show: false,
    title: 'WhatsApp Controller',
    icon: path.join(__dirname, '..', 'icons', 'icon-512x512.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true
    },
    autoHideMenuBar: true,
    resizable: true,
    minimizable: true,
    maximizable: true,
    fullscreenable: true
  });

  // Load appropriate content based on environment
  if (isDev) {
    mainWindow.loadURL('http://localhost:3434');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Enhanced window close handler
  mainWindow.on('close', async (event) => {
    if (isShuttingDown) {
      return; // Allow close if already shutting down
    }

    if (backendProcess && !backendProcess.killed) {
      console.log('Window close requested - preventing close and shutting down backend...');
      event.preventDefault();
      isShuttingDown = true;
      
      try {
        await terminateBackend();
        console.log('Backend shutdown complete, closing window...');
        
        // Remove the close listener to prevent recursion
        mainWindow.removeAllListeners('close');
        mainWindow.close();
      } catch (error) {
        console.error('Error during backend shutdown:', error);
        // Force close anyway
        mainWindow.removeAllListeners('close');
        mainWindow.close();
      }
    }
  });

  // Handle window closed event
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function startBackend() {
  // Ensure port is available
  const portAvailable = await isPortAvailable(backendPort);
  if (!portAvailable) {
    console.log(`Port ${backendPort} is busy, attempting to free it...`);
    await killProcessByPort(backendPort);
    
    // Wait a moment and check again
    await new Promise(resolve => setTimeout(resolve, 3000));
    const stillBusy = !(await isPortAvailable(backendPort));
    if (stillBusy) {
      console.error(`Failed to free port ${backendPort}`);
      return false;
    }
  }

  let backendPath;
  let backendArgs = [];

  if (isDev) {
    // Development: Start Python backend with uvicorn
    backendPath = 'python';
    backendArgs = ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', backendPort.toString(), '--reload'];
    const backendDir = path.join(__dirname, '..', '..', 'backend');
    
    console.log('Starting Python backend in development mode:', backendPath, backendArgs);
    console.log('Backend directory:', backendDir);
    
    backendProcess = spawn(backendPath, backendArgs, {
      cwd: backendDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
      shell: false
    });
  } else {
    // Production: Start packaged backend
    if (app.isPackaged) {
      backendPath = path.join(process.resourcesPath, 'backend.exe');
    } else {
      backendPath = path.join(__dirname, '..', '..', 'backend', 'dist', 'backend.exe');
    }

    if (!fs.existsSync(backendPath)) {
      console.error('Backend executable not found:', backendPath);
      return false;
    }

    console.log('Starting packaged backend:', backendPath);
    backendProcess = spawn(backendPath, [], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
      shell: false
    });
  }

  if (!backendProcess) {
    console.error('Failed to start backend process');
    return false;
  }

  // Store the PID for tracking
  console.log(`Backend process started with PID: ${backendProcess.pid}`);

  // Set up process event handlers
  backendProcess.on('error', (err) => {
    console.error('Backend process error:', err);
  });

  backendProcess.on('close', (code, signal) => {
    console.log(`Backend process closed with code: ${code}, signal: ${signal}`);
    backendProcess = null;
  });

  backendProcess.on('exit', (code, signal) => {
    console.log(`Backend process exited with code: ${code}, signal: ${signal}`);
  });

  // Log backend output
  if (backendProcess.stdout) {
    backendProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output) console.log('Backend stdout:', output);
    });
  }

  if (backendProcess.stderr) {
    backendProcess.stderr.on('data', (data) => {
      const output = data.toString().trim();
      if (output) console.error('Backend stderr:', output);
    });
  }

  return true;
}

// Enhanced backend termination function
async function terminateBackend() {
  if (!backendProcess) {
    console.log('No backend process to terminate');
    return;
  }

  console.log(`Terminating backend process (PID: ${backendProcess.pid})...`);

  return new Promise(async (resolve) => {
    if (backendProcess.killed) {
      console.log('Backend process already killed');
      resolve();
      return;
    }

    let resolved = false;
    const resolveOnce = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };

    // Set up timeout for forced termination
    const forceKillTimeout = setTimeout(async () => {
      if (resolved) return;
      
      console.warn('Backend did not terminate gracefully, force killing...');
      
      try {
        const pid = backendProcess.pid;
        
        if (process.platform === 'win32') {
          // Windows: Force kill process tree
          exec(`taskkill /PID ${pid} /F /T`, (err) => {
            if (err) console.error('Error during taskkill:', err.message);
          });
        } else {
          // Unix: Send SIGKILL
          try {
            process.kill(pid, 'SIGKILL');
          } catch (killError) {
            console.error('Error sending SIGKILL:', killError.message);
          }
        }
        
        // Wait a bit then kill by port as a fallback
        setTimeout(async () => {
          await killProcessByPort(backendPort);
          backendProcess = null;
          resolveOnce();
        }, 2000);
        
      } catch (error) {
        console.error('Error during force kill:', error);
        resolveOnce();
      }
    }, 8000); // Increased timeout

    // Handle graceful termination
    const onClose = () => {
      console.log('Backend process terminated gracefully');
      clearTimeout(forceKillTimeout);
      backendProcess = null;
      resolveOnce();
    };

    const onExit = () => {
      console.log('Backend process exited');
      clearTimeout(forceKillTimeout);
      backendProcess = null;
      resolveOnce();
    };

    // Set up one-time listeners
    backendProcess.once('close', onClose);
    backendProcess.once('exit', onExit);

    // Attempt graceful termination
    try {
      const pid = backendProcess.pid;
      console.log(`Sending SIGTERM to process ${pid}`);
      
      if (process.platform === 'win32') {
        // Windows: Try graceful termination first
        exec(`taskkill /PID ${pid} /T`, (err) => {
          if (err) {
            console.error('Error during graceful taskkill:', err.message);
            // If graceful kill fails, the timeout will handle force kill
          }
        });
      } else {
        // Unix: Try SIGTERM first
        process.kill(pid, 'SIGTERM');
      }
    } catch (error) {
      console.error('Error sending termination signal:', error);
      clearTimeout(forceKillTimeout);
      resolveOnce();
    }
  });
}

// Enhanced app shutdown handler
async function handleAppShutdown() {
  if (isShuttingDown) {
    return;
  }
  
  isShuttingDown = true;
  console.log('Application shutdown initiated...');
  
  try {
    // Terminate backend first
    if (backendProcess && !backendProcess.killed) {
      await terminateBackend();
    }
    
    // Ensure port is freed
    await killProcessByPort(backendPort);
    
    console.log('Shutdown complete');
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
}

// App event handlers
app.whenReady().then(async () => {
  console.log('Electron app ready, checking backend status...');
  
  // Check if backend is already running
  const backendRunning = await isBackendRunning();
  
  if (!backendRunning) {
    console.log('Starting backend server...');
    const started = await startBackend();
    
    if (started) {
      console.log('Waiting for backend to be ready...');
      // Wait for backend to be ready with retries
      const ready = await isBackendRunning(10, 1000);
      
      if (ready) {
        console.log('Backend is ready, creating window...');
        createWindow();
      } else {
        console.error('Backend failed to start properly');
        await handleAppShutdown();
        app.quit();
      }
    } else {
      console.error('Failed to start backend');
      app.quit();
    }
  } else {
    console.log('Backend is already running, creating window...');
    createWindow();
  }
});

app.on('window-all-closed', async () => {
  console.log('All windows closed');
  await handleAppShutdown();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async (event) => {
  if (isShuttingDown) {
    return; // Allow quit if already shutting down
  }
  
  if (backendProcess && !backendProcess.killed) {
    console.log('App is quitting, preventing quit to shutdown backend first...');
    event.preventDefault();
    
    await handleAppShutdown();
    
    console.log('Backend terminated, quitting app...');
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && !isShuttingDown) {
    createWindow();
  }
});

// Enhanced process signal handlers
const handleProcessExit = async (signal) => {
  console.log(`Received ${signal}, cleaning up...`);
  await handleAppShutdown();
  process.exit(0);
};

process.on('SIGINT', handleProcessExit);
process.on('SIGTERM', handleProcessExit);

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('Uncaught Exception:', error);
  await handleAppShutdown();
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  await handleAppShutdown();
  process.exit(1);
});

// IPC handlers
ipcMain.handle('backend-status', async () => {
  return await isBackendRunning();
});

ipcMain.handle('restart-backend', async () => {
  console.log('Restarting backend...');
  await terminateBackend();
  await new Promise(resolve => setTimeout(resolve, 3000));
  return await startBackend();
});