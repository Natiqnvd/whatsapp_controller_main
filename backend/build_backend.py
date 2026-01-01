import PyInstaller.__main__
import os
import shutil
import sys

def build_backend():
    # Define paths (assuming we're already in backend directory)
    uploads_dir = "uploads"
    thumbnail_dir = "thumbnails"
    dist_dir = "dist"
    build_dir = "build"

    # Clean previous builds
    for dir_path in [dist_dir, build_dir]:
        if os.path.exists(dir_path):
            shutil.rmtree(dir_path)

    # Create required directories
    for dir_path in [uploads_dir, thumbnail_dir]:
        os.makedirs(dir_path, exist_ok=True)

    # PyInstaller configuration
    pyinstaller_args = [
        'server.py',
        '--onefile',
        '--noconsole',
        '--clean',
        '--distpath=dist',
        '--workpath=build',
        '--specpath=.',
        '--name=backend',
        
        # Hidden imports
        *[f'--hidden-import={mod}' for mod in [
            'uvicorn.logging',
            'uvicorn.loops',
            'uvicorn.loops.auto',
            'uvicorn.protocols',
            'uvicorn.protocols.http',
            'uvicorn.protocols.http.auto',
            'uvicorn.protocols.websockets',
            'uvicorn.protocols.websockets.auto',
            'uvicorn.lifespan',
            'uvicorn.lifespan.on',
            'uiautomation',
            'pandas',
            'numpy'
        ]],
        
        # Collect all (for dynamic imports)
        *[f'--collect-all={pkg}' for pkg in [
            'fastapi',
            'uvicorn',
            'starlette',
            'uiautomation',
            'pandas'
        ]],
        
        # Add data files
        f'--add-data={uploads_dir}{os.pathsep}{uploads_dir}',
        f'--add-data={thumbnail_dir}{os.pathsep}{thumbnail_dir}'
    ]

    # Run PyInstaller
    PyInstaller.__main__.run(pyinstaller_args)

if __name__ == "__main__":
    build_backend()