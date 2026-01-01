import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Loader2, AlertCircle, CheckCircle, XCircle, Download, Upload, Image, FileText, MessageSquare, Users, X, Clock, Play, Trash2,
  Image as ImageIcon, Video as VideoIcon, Database, Minus
 } from 'lucide-react';
 
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tab';
import jsPDF from "jspdf";
import "jspdf-autotable";
import ErrorCard from '../ui/ErrorCard';
import SavedContactSelector from './SavedContactSelector';
import { API_ENDPOINTS } from "../../config/api";

const AttachmentSender = ({ state, updateState, adminNumber }) => {
  const csvInputRef = useRef();
  const mediaInputRef = useRef();
  const pdfInputRef = useRef();
  const [previewModal, setPreviewModal] = useState({ open: false, url: '', isVideo: false });
  const{
    csvData,
    selectedMedia,
    selectedPDFs,
    pdfPaths,
    pdfPreviews,
    mediaPreviews,
    mediaPaths,
    message,
    isLoading,
    error,
    results,
    processedCount,
    totalContacts,
  } = state;


  const applyWhatsAppFormatting = (text) => {
    return text
      .replace(/\*([^*]+)\*/g, "<strong>$1</strong>")
      .replace(/_([^_]+)_/g, "<em>$1</em>")
      .replace(/~([^~]+)~/g, "<del>$1</del>")
      .replace(/([^]+)/g, "<code>$1</code>")
      .replace(/\n/g, "<br />");
  };

  const handleCSVUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      updateState({ isLoading: true, error: '' });
      const response = await fetch(API_ENDPOINTS.CONTACTS.UPLOAD_CSV, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error(await response.text());

      const result = await response.json();
      updateState({
        csvData: result.contacts,
        totalContacts: result.contacts.length,
        isLoading: false
      });
    } catch (err) {
      updateState({
        error: `CSV Upload Error: ${err.message}`,
        isLoading: false
      });
    }
  };

  const handleMediaUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;
    
    const MAX_SIZE_MB = 100;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
  
    const oversizedFiles = files.filter(file => file.size > MAX_SIZE_BYTES);
    if (oversizedFiles.length > 0) {
      updateState({
        error: `File(s) too large: ${oversizedFiles.map(f => f.name).join(', ')}. Max size is ${MAX_SIZE_MB} MB.`,
      });
      return;
    }
  
    // Filter files to allow new ones or previously removed ones
    const removedFilesList = state.removedFiles || [];
    const newFiles = files.filter(file => {
      const isDuplicate = selectedMedia.some(media => {
        // Compare file names (might be stored in name or originalName property)
        const mediaName = media.name || media.originalName;
        return mediaName === file.name;
      });
      const wasRemoved = removedFilesList.includes(file.name);
      
      // Include the file if it's not a duplicate OR if it was previously removed
      return !isDuplicate || wasRemoved;
    });
    
    if (newFiles.length === 0) {
      updateState({ error: 'No new Media to upload.' });
      return;
    }
    
    const formData = new FormData();
    newFiles.forEach(file => formData.append('media', file));
  
    try {
      console.log("Uploading files:", newFiles.map(f => f.name));
      
      const response = await fetch(API_ENDPOINTS.MEDIA.UPLOAD, {
        method: 'POST',
        body: formData
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }
  
      const result = await response.json();
      console.log("Complete API response:", result);
      console.log("Thumbnail URLs:", result.media.map(item => item.thumbnail));
      
      // Store the complete media objects, not just the files
      const newMediaItems = result.media.map((item, index) => ({
        ...newFiles[index],
        name: newFiles[index].name,
        savedName: item.saved_name,
        originalName: item.original_name,
        thumbnailUrl: item.thumbnail,
        url: item.url
      }));
      
      // Remove successfully uploaded files from the removedFiles list
      const uploadedFileNames = newFiles.map(file => file.name);
      const newRemovedFiles = removedFilesList.filter(
        name => !uploadedFileNames.includes(name)
      );
      
      // Update state with new information
      updateState({
        selectedMedia: [...selectedMedia, ...newMediaItems],
        mediaPreviews: [...mediaPreviews, ...result.media.map(item => item.thumbnail)],
        mediaPaths: [...mediaPaths, ...result.media.map(item => item.saved_name)],
        removedFiles: newRemovedFiles
      });
    } catch (err) {
      console.error("Upload error:", err);
      
      let errorMessage = 'Unknown error occurred';
      if (err instanceof Error && err.message) {
        errorMessage = err.message;
      } else if (typeof err === 'object') {
        errorMessage = err?.detail || err?.message || JSON.stringify(err);
      }
      
      updateState({ error: `Media Upload Error: ${errorMessage}` });
    }
  };
  
  // Updated render component for displaying media previews
  const MediaPreviewComponent = ({ idx, media, removeMedia, openPreview }) => {
    const [error, setError] = useState(false);
    const placeholderImg = '/src/Components/WhatsAppAutomation/placeholder.jpg'; // Update this to a valid path
    
    // Determine if it's a video based on file type or name
    const isVideo = 
      media?.type?.startsWith('video') || 
      (media?.originalName || media?.name || "").match(/\.(mp4|mov|avi|mkv|wmv|3gp)$/i);

    // Use the thumbnail for videos, and the file URL for images
    const previewUrl = isVideo ? media.thumbnailUrl || media.thumbnail : media.url;

    return (
      <div key={idx} className="relative group rounded-lg overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-all">
        {!error ? (
          <img
            src={previewUrl}
            alt={`Preview ${idx + 1}`}
            className="w-full h-32 object-cover cursor-pointer"
            onClick={() => openPreview(isVideo ? media.url : previewUrl, isVideo)}
            onError={() => setError(true)}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-32 bg-gray-100">
            {isVideo ? <VideoIcon className="h-8 w-8 text-gray-400" /> : <ImageIcon className="h-8 w-8 text-gray-400" />}
          </div>
        )}

        {/* Play overlay for videos */}
        {isVideo && !error && (
          <button
            type="button"
            className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition group"
            style={{ cursor: 'pointer' }}
            onClick={() => openPreview(media.url, true)}
            aria-label="Play video"
          >
            <div className="bg-black/50 rounded-full p-2">
              <Play className="h-6 w-6 text-white" />
            </div>
          </button>
        )}

        {/* Remove button */}
        <button
          onClick={() => removeMedia(idx)}
          className="absolute top-1 right-1 bg-white/80 hover:bg-white text-red-600 border border-red-200 hover:border-red-400 rounded-full p-1 shadow-sm transition-colors"
          aria-label={`Remove media ${idx + 1}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  };

  const handlePDFUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;
  
    // Get the removedFiles array from state (initialize to empty array if not present)
    const removedFilesList = state.removedFiles || [];
  
    // Filter files to allow new ones or previously removed ones
    const newFiles = files.filter(file => {
      const isDuplicate = selectedPDFs.some(pdf => pdf.name === file.name);
      const wasRemoved = removedFilesList.includes(file.name);
      
      // Include the file if it's not a duplicate OR if it was previously removed
      return !isDuplicate || wasRemoved;
    });
  
    if (newFiles.length === 0) {
      updateState({ error: 'No new PDFs to upload (duplicates detected).' });
      return;
    }
  
    const formData = new FormData();
    newFiles.forEach(file => formData.append('pdfs', file));
  
    try {
      const response = await fetch(API_ENDPOINTS.PDF.UPLOAD, {
        method: 'POST',
        body: formData
      });
      
      if (error) {
        alert(error);
      }
  
      if (!response.ok) {
        const errorData = await response.json(); // Get error details from backend
        throw new Error(errorData.message || 'Upload failed');
      }
  
      const result = await response.json();
  
      // Remove successfully uploaded files from the removedFiles list
      const uploadedFileNames = newFiles.map(file => file.name);
      const newRemovedFiles = removedFilesList.filter(
        name => !uploadedFileNames.includes(name)
      );
  
      updateState({
        selectedPDFs: [...selectedPDFs, ...newFiles],
        pdfPreviews: [...pdfPreviews, ...result.pdfs.map(pdf => pdf.url)],
        pdfPaths: [...pdfPaths, ...result.pdfs.map(pdf => pdf.saved_name)] || [],
        removedFiles: newRemovedFiles
      });
    } catch (err) {
      updateState({ error: `PDF Upload Error: ${err.message}` });
    }
  };
  

  const removeMedia = async (index) => {
    const filename = mediaPaths[index]; // Get the filename from the selected medias
    const mediaItem = selectedMedia[index]; // Get the full media item
    const originalFileName = mediaItem.name || mediaItem.originalName || filename; // Get the original file name
    
    const newMedia = [...selectedMedia];
    const newPreviews = [...mediaPreviews];
    const newPaths = [...mediaPaths];
    
    try {
      // Make a DELETE request to remove the media from the backend
      const response = await fetch(API_ENDPOINTS.MEDIA.REMOVE(filename), {
        method: 'DELETE',
      });
  
      if (response.ok) {
        const data = await response.json();
        console.log(data.message); // Log success message from the server
  
        // Remove the media and preview from the state
        URL.revokeObjectURL(newPreviews[index]);
        newMedia.splice(index, 1);
        newPreviews.splice(index, 1);
        newPaths.splice(index, 1);
  
        // Add the original file name to the removedFiles list
        const newRemovedFiles = [...(state.removedFiles || [])];
        if (originalFileName && !newRemovedFiles.includes(originalFileName)) {
          newRemovedFiles.push(originalFileName);
        }
  
        // Update state with the new medias, previews, and removedFiles
        updateState({
          selectedMedia: newMedia,
          mediaPreviews: newPreviews,
          mediaPaths: newPaths,
          removedFiles: newRemovedFiles
        });
        // Reset media input so user can re-select the same file
        if (mediaInputRef.current) {
          mediaInputRef.current.value = '';
        }
      } else {
        const errorData = await response.json();
        console.error(errorData.message); // Log error message from the backend
      }
    } catch (error) {
      alert(error);
      console.error('Error removing media:', error); // Handle network errors
    }
  };
  
  const removePDF = async (index) => {
    const filename = pdfPaths[index]; // Get the filename from the selected PDFs
    const pdfItem = selectedPDFs[index]; // Get the full PDF item
    const originalFileName = pdfItem.name; // Get the original file name
    
    const newPDFs = [...selectedPDFs];
    const newPreviews = [...pdfPreviews];
    const newPaths = [...pdfPaths];
    
    try {
      // Make a DELETE request to remove the PDF from the backend
      const response = await fetch(API_ENDPOINTS.PDF.REMOVE(filename), {
        method: 'DELETE',
      });
  
      if (response.ok) {
        const data = await response.json();
        console.log(data.message); // Log success message from the server
  
        // Remove the PDF from the state
        newPDFs.splice(index, 1);
        newPreviews.splice(index, 1);
        newPaths.splice(index, 1);
  
        // Add the original file name to the removedFiles list
        const removedFilesList = state.removedFiles || [];
        const newRemovedFiles = [...removedFilesList];
        
        if (originalFileName && !newRemovedFiles.includes(originalFileName)) {
          newRemovedFiles.push(originalFileName);
        }
  
        updateState({
          selectedPDFs: newPDFs,
          pdfPreviews: newPreviews,
          pdfPaths: newPaths,
          removedFiles: newRemovedFiles
        });
        // Reset PDF input so user can re-select the same file
        if (pdfInputRef.current) {
          pdfInputRef.current.value = '';
        }
      } else {
        const errorData = await response.json();
        console.error(errorData.message); // Log error message from the backend
      }
    } catch (error) {
      console.error('Error removing PDF:', error); // Handle network errors
    }
  };

  
  const handleSend = async () => {

  console.log('handleSend called with adminNumber:', adminNumber, 'type:', typeof adminNumber);
  
  if (!adminNumber || adminNumber.trim() === '') {
    updateState({ 
      error: 'Admin number is required. Please set your admin number in the top bar before sending messages.' 
    });
    return;
  }
    if (!state.csvData.length) {
      updateState({ error: 'Please upload a contact list first.' });
      return;
    }

    const formData = new FormData();

    formData.append("data", JSON.stringify(csvData));
    formData.append("media_paths", selectedMedia.length > 0 ? JSON.stringify(mediaPaths) : "[]");
    formData.append("pdf_paths", selectedPDFs.length > 0 ? JSON.stringify(pdfPaths) : "[]");
    formData.append("admin_no", adminNumber)
    
    if (message) {
      formData.append('message', message);
    }

    try {
      updateState({ isLoading: true, error: '', results: [], processedCount: 0 });
      
      const response = await fetch(API_ENDPOINTS.SEND_ATTACHMENTS, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }     

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let currentProcessedCount = 0;
      let currentResults = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(line => line.trim());

        for (const line of lines) {
          try {
            const update = JSON.parse(line);
            currentProcessedCount++;
            currentResults.push(update);
            updateState({
              processedCount: currentProcessedCount,
              results: [...currentResults]
            });
          } catch (error) {
            console.error("Error parsing update:", error);
          }
        }
      }
    } catch (err) {
      updateState({ error: "Error sending: " + err.message });
    } finally {
      updateState({ isLoading: false });
    }
  };


const handleDownloadReport = () => {
  if (results.length === 0) {
    alert("No results to download.");
    return;
  }

  const doc = new jsPDF();
  
  // Add a header with gradient-like effect
  doc.setFillColor(240, 249, 255); // light blue
  doc.rect(0, 0, doc.internal.pageSize.width, 40, 'F');
  doc.setFillColor(219, 234, 254); // slightly darker blue
  doc.rect(0, 38, doc.internal.pageSize.width, 2, 'F');

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(30, 58, 138); // dark blue
  doc.text("WhatsApp Automation Report", 20, 25);

  // Timestamp
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(new Date().toLocaleString(), doc.internal.pageSize.width - 20, 25, { align: "right" });

  // Filter out batch_complete status and calculate stats
  const validResults = results.filter(r => r.status !== "batch_complete");
  const successful = validResults.filter(r => r.status === "success").length;
  const failed = validResults.filter(r => r.status === "error").length;
  const skippedInvalid = validResults.filter(r => r.status === "Skipped Invalid Number" || r.message === "invalid number").length;
  const partial = validResults.filter(r => r.status === "partial").length;
  const successRate = validResults.length > 0 ? Math.round((successful / validResults.length) * 100) : 0;

  // Stats section with colored boxes (adjusted for 5 boxes)
  const statsY = 50;
  const boxWidth = 28;
  const boxHeight = 20;
  const boxSpacing = 32;
  
  // Total Messages Box
  doc.setFillColor(249, 250, 251); // light gray
  doc.roundedRect(20, statsY, boxWidth, boxHeight, 2, 2, 'F');
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text("Total", 20 + boxWidth/2, statsY + 6, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(validResults.length.toString(), 20 + boxWidth/2, statsY + 16, { align: "center" });

  // Successful Box
  doc.setFillColor(220, 252, 231); // light green
  doc.roundedRect(20 + boxSpacing, statsY, boxWidth, boxHeight, 2, 2, 'F');
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(22, 163, 74);
  doc.text("Success", 20 + boxSpacing + boxWidth/2, statsY + 6, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(successful.toString(), 20 + boxSpacing + boxWidth/2, statsY + 16, { align: "center" });

  // Invalid Box
  doc.setFillColor(254, 249, 195); // light yellow
  doc.roundedRect(20 + boxSpacing * 2, statsY, boxWidth, boxHeight, 2, 2, 'F');
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(202, 138, 4);
  doc.text("Invalid", 20 + boxSpacing * 2 + boxWidth/2, statsY + 6, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(skippedInvalid.toString(), 20 + boxSpacing * 2 + boxWidth/2, statsY + 16, { align: "center" });

  // Failed Box
  doc.setFillColor(254, 226, 226); // light red
  doc.roundedRect(20 + boxSpacing * 3, statsY, boxWidth, boxHeight, 2, 2, 'F');
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(220, 38, 38);
  doc.text("Failed", 20 + boxSpacing * 3 + boxWidth/2, statsY + 6, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(failed.toString(), 20 + boxSpacing * 3 + boxWidth/2, statsY + 16, { align: "center" });

  // Success Rate Box with Progress Bar
  doc.setFillColor(219, 234, 254); // light blue
  doc.roundedRect(20 + boxSpacing * 4, statsY, boxWidth + 8, boxHeight, 2, 2, 'F');
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(37, 99, 235);
  doc.text("Rate", 20 + boxSpacing * 4 + (boxWidth + 8)/2, statsY + 6, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(successRate + "%", 20 + boxSpacing * 4 + (boxWidth + 8)/2, statsY + 16, { align: "center" });

  // Progress bar
  const barWidth = 140;
  const barHeight = 3;
  const barY = statsY + 25;
  // Background bar
  doc.setFillColor(226, 232, 240);
  doc.roundedRect(20, barY, barWidth, barHeight, 1, 1, 'F');
  // Progress bar
  doc.setFillColor(37, 99, 235);
  doc.roundedRect(20, barY, (barWidth * successRate) / 100, barHeight, 1, 1, 'F');

  // Helper function to get status display
  const getStatusDisplay = (result) => {
    if (result.status === "success") return "✓ All Sent";
    if (result.message === "invalid number" || result.status === "Skipped Invalid Number") return "! Invalid";
    if (result.status === "partial") return "~ Partial";
    return "✕ Failed";
  };

  // Helper function to get status color
  const getStatusColor = (result) => {
    if (result.status === "success") return [22, 163, 74]; // green
    if (result.message === "invalid number" || result.status === "Skipped Invalid Number") return [202, 138, 4]; // yellow
    if (result.status === "partial") return [202, 138, 4]; // yellow
    return [220, 38, 38]; // red
  };

  // Helper function to format boolean status
  const formatBooleanStatus = (status) => {
    return status === true ? "✓" : "✕";
  };

  // Helper function to get boolean status color
  const getBooleanStatusColor = (status) => {
    return status === true ? [22, 163, 74] : [220, 38, 38]; // green or red
  };

  // Results Table with detailed columns
  doc.autoTable({
    startY: statsY + 35,
    headStyles: { 
      fillColor: [241, 245, 249],
      textColor: [71, 85, 105],
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: 2
    },
    bodyStyles: { 
      fontSize: 7,
      textColor: [51, 65, 85],
      cellPadding: 2
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 10, right: 10 },
    head: [["Status", "Name", "Number", "Msg", "Media", "PDF", "Message", "Time"]],
    body: validResults.map(r => [
      {
        content: getStatusDisplay(r),
        styles: {
          textColor: getStatusColor(r),
          fontStyle: 'bold'
        }
      },
      r.name || "N/A",
      r.number || "N/A",
      {
        content: formatBooleanStatus(r.message_sent),
        styles: {
          textColor: getBooleanStatusColor(r.message_sent),
          fontStyle: 'bold',
          halign: 'center'
        }
      },
      {
        content: formatBooleanStatus(r.media_sent),
        styles: {
          textColor: getBooleanStatusColor(r.media_sent),
          fontStyle: 'bold',
          halign: 'center'
        }
      },
      {
        content: formatBooleanStatus(r.pdf_sent),
        styles: {
          textColor: getBooleanStatusColor(r.pdf_sent),
          fontStyle: 'bold',
          halign: 'center'
        }
      },
      {
        content: r.message || "N/A",
        styles: {
          fontSize: 6,
          cellWidth: 'wrap'
        }
      },
      r.timestamp || "N/A"
    ]),
    columnStyles: {
      0: { cellWidth: 22 }, // Status
      1: { cellWidth: 25 }, // Name
      2: { cellWidth: 25 }, // Number
      3: { cellWidth: 12 }, // Message sent
      4: { cellWidth: 12 }, // Media sent
      5: { cellWidth: 12 }, // PDF sent
      6: { cellWidth: 'auto' }, // Message content
      7: { cellWidth: 25 } // Time
    },
    didDrawPage: function(data) {
      // Add page number at the bottom
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(
        `Page ${data.pageNumber}`,
        data.settings.margin.left,
        doc.internal.pageSize.height - 10
      );
    }
  });

  // Add legend at the bottom of the last page
  const pageCount = doc.getNumberOfPages();
  doc.setPage(pageCount);
  
  // Legend
  const legendY = doc.autoTable.previous.finalY + 10;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Legend:", 20, legendY);
  
  doc.setFontSize(8);
  doc.setTextColor(22, 163, 74);
  doc.text("✓ = Sent/Success", 20, legendY + 8);
  doc.setTextColor(220, 38, 38);
  doc.text("✕ = Failed", 60, legendY + 8);
  doc.setTextColor(202, 138, 4);
  doc.text("! = Invalid Number", 100, legendY + 8);
  doc.setTextColor(202, 138, 4);
  doc.text("~ = Partial Success", 160, legendY + 8);

  // Footer
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    "Generated by WhatsApp Sender - Natiqnvd",
    doc.internal.pageSize.width / 2,
    doc.internal.pageSize.height - 10,
    { align: "center" }
  );

  // Save the PDF
  doc.save("whatsapp_detailed_report.pdf");
};

  const [mediaTab] = useState('medias');
  const [pdfTab] = useState('pdfs');

  // Ensure Escape key closes modal regardless of focus
  useEffect(() => {
    if (!previewModal.open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setPreviewModal({ open: false, url: '', isVideo: false });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewModal.open]);
  
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="w-full flex flex-col items-center mb-8">
        <h1 className="text-4xl font-extrabold">Attachment Sender</h1>
        <p className="text-gray-400 text-sm">Send media and PDFs to multiple contacts</p>
        
        {isLoading && (
          <div className="flex items-center space-x-2 mt-2">
            <Loader2 className="animate-spin h-5 w-5" />
            <span>{processedCount}/{totalContacts} Processed</span>
          </div>
        )}
      </div>

      {error && <ErrorCard error={error} />}

      <Tabs defaultValue="contacts">
        <TabsList className="grid grid-cols-4 gap-4 mb-6">
          <TabsTrigger value="contacts" className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <span>Contacts</span>
          </TabsTrigger>
          <TabsTrigger value="media" className="flex items-center space-x-2">
            <Image className="h-4 w-4" />
            <span>Media</span>
          </TabsTrigger>
          <TabsTrigger value="pdfs" className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>PDFs</span>
          </TabsTrigger>
          <TabsTrigger value="message" className="flex items-center space-x-2">
            <MessageSquare className="h-4 w-4" />
            <span>Message</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <CardTitle>Select Contact Source</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="upload">
                <TabsList className="grid grid-cols-2 gap-4 mb-6">
                  <TabsTrigger value="upload" className="flex items-center space-x-2">
                    <Upload className="h-4 w-4" />
                    <span>Upload CSV</span>
                  </TabsTrigger>
                  <TabsTrigger value="saved" className="flex items-center space-x-2">
                    <Database className="h-4 w-4" />
                    <span>Saved Lists</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="upload">
                  <div className="space-y-4">
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Upload className="w-8 h-8 mb-4 text-gray-500" />
                          <p className="mb-2 text-sm text-gray-500">
                            <span className="font-semibold">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-gray-500">CSV file with name and number columns</p>
                        </div>
                        <input ref={csvInputRef} type="file" className="hidden" accept=".csv" onChange={handleCSVUpload} />
                      </label>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="saved">
                  <SavedContactSelector 
                    onContactsSelected={(contacts) => {
                      updateState({
                        csvData: contacts,
                        totalContacts: contacts.length
                      });
                    }}
                    updateState={updateState}
                  />
                </TabsContent>
              </Tabs>

              {csvData.length > 0 && (
                <div className="border rounded-lg mt-6">
                  <div className="overflow-hidden">
                    <div className="bg-gray-50 border-b">
                      <div className="grid grid-cols-2">
                        <div className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</div>
                        <div className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Number</div>
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {csvData.map((contact, idx) => (
                        <div 
                          key={idx} 
                          className="grid grid-cols-2 border-b last:border-b-0 hover:bg-gray-50"
                        >
                          <div className="px-6 py-4 text-sm text-gray-900 truncate">{contact.name}</div>
                          <div className="px-6 py-4 text-sm text-gray-900 truncate">{contact.number}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-gray-50 px-6 py-3 border-t">
                    <p className="text-sm text-gray-500">
                      Total Contacts: {csvData.length}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      <TabsContent value="media">
        <Card>
          <CardHeader>
            <CardTitle>Upload Media</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <input
                ref={mediaInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleMediaUpload}
                className="hidden"
                id="media-upload"
              />
              <label
                htmlFor="media-upload"
                className={`flex items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50
                  ${mediaTab === 'medias' ? 'bg-blue-100' : ''}`}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Image className="w-8 h-8 mb-4 text-gray-500" />
                  <p className="text-sm text-gray-500">Click to upload Media</p>
                  <p className="text-xs text-gray-400 mt-1">(Max file size: 100 MB)</p>
                </div>
              </label>
{/* 
              {error && (
                <div className="text-sm text-red-500 bg-red-50 border border-red-200 p-2 rounded-md">
                  {error}
                </div>
              )} */}

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {mediaPreviews.map((preview, idx) => (
                    <MediaPreviewComponent 
                      key={idx}
                      idx={idx}
                      media={selectedMedia[idx]}
                      removeMedia={removeMedia}
                      openPreview={(url, isVideo) => setPreviewModal({ open: true, url, isVideo })}
                    />
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

        <TabsContent value="pdfs">
          <Card>
            <CardHeader>
              <CardTitle>Upload PDFs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={handlePDFUpload}
                  className="hidden"
                  id="pdf-upload"
                />
                <label
                  htmlFor="pdf-upload"
                  className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50
                    ${pdfTab === 'pdfs' ? 'bg-red-100': ''}`}
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <FileText className="w-8 h-8 mb-4 text-gray-500" />
                    <p className="text-sm text-gray-500">Click to upload PDFs</p>
                  </div>
                </label>

                {selectedPDFs.length > 0 && (
                  <div className="space-y-2">
                    {selectedPDFs.map((pdf, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex flex-col">
                          <span className="text-sm truncate">{pdf.name}</span>
                          <a href={pdfPreviews[idx]} target="_blank" className="text-blue-500 text-sm">
                            View PDF
                          </a>
                        </div>
                        <button
                          onClick={() => removePDF(idx)}
                          className="p-1 hover:bg-gray-200 rounded-full"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="message">
          <Card>
            <CardHeader>
              <CardTitle>Message Template</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <textarea
                  value={message}
                  onChange={(e) => updateState({ message: e.target.value })}
                  placeholder="Enter your message. Use {name} to include the contact's name."
                  className="w-full h-64 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent resize-none"
                />
                <p className="text-sm text-gray-500">
                  Use <code className="bg-gray-100 px-1 rounded">*text*</code> for bold, <code className="bg-gray-100 px-1 rounded">{'{name}'}</code> for personalization
                </p>
                {csvData.length > 0 && message && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-purple-800 mb-2">Preview:</p>
                    <div
                      className="text-gray-900 bg-white p-3 rounded border"
                      dangerouslySetInnerHTML={{
                        __html: applyWhatsAppFormatting(message.replace('{name}', csvData[0]?.name || 'John'))
                      }}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex flex-col items-start mb-2 mt-2 space-y-2 w-full">
        <Button
          variant="outline"
          onClick={async () => {
            // First, remove media and PDFs from the system if they exist
            if (state.selectedMedia && state.selectedMedia.length > 0) {
              removeMedia(state.selectedMedia.map(med => med.name), '/media/remove');
            }
            if (state.selectedPDFs && state.selectedPDFs.length > 0) {
              removePDF(state.selectedPDFs.map(pdf => pdf.name), '/pdf/remove');
            }

            // Then, clear all state
            updateState({
              csvData: [],
              selectedMedia: [],
              selectedPDFs: [],
              mediaPreviews: [],
              message: '',
              results: [],
              processedCount: (0),
              totalContacts: (0)
            });
            // Reset CSV file input so user can re-select the same file
            if (csvInputRef.current) {
              csvInputRef.current.value = '';
            }
            // Reset media and PDF file inputs so user can re-select the same files
            if (mediaInputRef.current) {
              mediaInputRef.current.value = '';
            }
            if (pdfInputRef.current) {
              pdfInputRef.current.value = '';
            }
          }}
          className="flex items-center space-x-2 px-4 py-2 bg-transparent text-black hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border-none shadow-none focus:outline-gray-200"
        >
          <Trash2 className="h-4 w-4" />
          <span>Clear All</span>
        </Button>

        <div className="w-full flex justify-center">
          <Button
            onClick={handleSend}
            disabled={
              isLoading ||
              !csvData.length ||
              (!message && (!selectedMedia.length && !selectedPDFs.length))
            }
            className="flex items-center space-x-2 px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin h-4 w-4" />
                <span>Sending... {processedCount}/{totalContacts}</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span>Send Messages</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {results.length > 0 && (
        <Card className="shadow-lg mt-6">
          <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50 py-3">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <span className="text-blue-900 text-sm font-medium">Results</span>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDownloadReport}
                className="flex items-center space-x-1 hover:bg-blue-50 h-8 px-2 text-xs"
              >
                <Download className="h-3 w-3" />
                <span>Download Report</span>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {/* Stats Grid */}
            <div className="grid grid-cols-6 gap-2 mb-4 mt-2">
              <div className="bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-gray-600">Total</p>
                  <Users className="h-4 w-4 text-gray-400" />
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {results.filter(result => result.status !== "batch_complete").length}
                </p>
              </div>

              <div className="bg-white p-2 rounded-lg border border-green-100 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-green-600">Success</p>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
                <p className="text-lg font-bold text-green-600">
                  {results.filter(r => r.status === "success").length}
                </p>
              </div>

              <div className="bg-white p-2 rounded-lg border border-yellow-100 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-yellow-600">Partial</p>
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                </div>
                <p className="text-lg font-bold text-yellow-600">
                  {results.filter(r => r.status === "partial").length}
                </p>
              </div>

              <div className="bg-white p-2 rounded-lg border border-orange-100 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-orange-600">Invalid</p>
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                </div>
                <p className="text-lg font-bold text-orange-600">
                  {results.filter(r => r.status === "skipped" && r.message === "invalid number").length}
                </p>
              </div>

              <div className="bg-white p-2 rounded-lg border border-red-100 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-red-600">Failed</p>
                  <XCircle className="h-4 w-4 text-red-500" />
                </div>
                <p className="text-lg font-bold text-red-600">
                  {results.filter(r => r.status === "error").length}
                </p>
              </div>

              <div className="bg-white p-2 rounded-lg border border-blue-100 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-blue-600">Rate</p>
                  <span className="text-lg font-bold text-blue-600">
                    {(() => {
                      const validResults = results.filter(r => r.status !== "batch_complete");
                      const successCount = results.filter(r => r.status === "success").length;
                      return validResults.length > 0 ? Math.round((successCount / validResults.length) * 100) : 0;
                    })()}%
                  </span>
                </div>
                <div className="w-full bg-blue-100 rounded-full h-1.5">
                  <div 
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-500" 
                    style={{ 
                      width: `${(() => {
                        const validResults = results.filter(r => r.status !== "batch_complete");
                        const successCount = results.filter(r => r.status === "success").length;
                        return validResults.length > 0 ? Math.round((successCount / validResults.length) * 100) : 0;
                      })()}%` 
                    }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Results Table */}
            <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
              <div className="overflow-x-auto" style={{ maxHeight: '400px' }}>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">Status</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-40">Name</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-40">Number</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">Message</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">Media</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">PDF</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Message</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">Time</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {results
                      .filter(result => result.status !== "batch_complete")
                      .map((result, idx) => (
                      <tr 
                        key={idx} 
                        className={`
                          hover:bg-gray-50 transition-colors
                          ${result.status === "success" ? "bg-green-50/30" : 
                            result.status === "skipped" ? "bg-gray-50/30" : 
                            result.status === "partial" ? "bg-yellow-50/30" :
                            result.status === "error" ? "bg-red-50/30" :
                            "bg-gray-50/30"}
                        `}
                      >
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center space-x-1.5">
                            {result.status === "success" ? (
                              <>
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <span className="text-xs font-medium text-green-600">All Sent</span>
                              </>
                            ) : result.status === "skipped" && result.message === "invalid number" ? (
                              <>
                                <AlertCircle className="h-4 w-4 text-orange-500" />
                                <span className="text-xs font-medium text-orange-600">Invalid</span>
                              </>
                            ) : result.status === "skipped" && result.message === "Nothing to send" ? (
                              <>
                                <Minus className="h-4 w-4 text-gray-500" />
                                <span className="text-xs font-medium text-gray-600">Skipped</span>
                              </>
                            ) : result.status === "partial" ? (
                              <>
                                <AlertCircle className="h-4 w-4 text-yellow-500" />
                                <span className="text-xs font-medium text-yellow-600">Partial</span>
                              </>
                            ) : result.status === "error" ? (
                              <>
                                <XCircle className="h-4 w-4 text-red-500" />
                                <span className="text-xs font-medium text-red-600">Failed</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="h-4 w-4 text-red-500" />
                                <span className="text-xs font-medium text-red-600">Unknown</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="text-xs text-gray-900">{result.name || 'N/A'}</div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="text-xs text-gray-600">{result.number || 'N/A'}</div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {result.message_sent === true ? (
                            <CheckCircle className="h-4 w-4 text-green-500 mx-auto" title="Message sent" />
                          ) : result.message_sent === false ? (
                            <XCircle className="h-4 w-4 text-red-500 mx-auto" title="Message failed" />
                          ) : (
                            <Minus className="h-4 w-4 text-gray-400 mx-auto" title="Not attempted" />
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {result.media_sent === true ? (
                            <CheckCircle className="h-4 w-4 text-green-500 mx-auto" title="Media sent" />
                          ) : result.media_sent === false ? (
                            <XCircle className="h-4 w-4 text-red-500 mx-auto" title="Media failed" />
                          ) : (
                            <Minus className="h-4 w-4 text-gray-400 mx-auto" title="Not attempted" />
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {result.pdf_sent === true ? (
                            <CheckCircle className="h-4 w-4 text-green-500 mx-auto" title="PDF sent" />
                          ) : result.pdf_sent === false ? (
                            <XCircle className="h-4 w-4 text-red-500 mx-auto" title="PDF failed" />
                          ) : (
                            <Minus className="h-4 w-4 text-gray-400 mx-auto" title="Not attempted" />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="text-xs text-gray-600 max-w-xs truncate">{result.message || 'N/A'}</div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center text-xs text-gray-500">
                            <Clock className="h-3 w-3 mr-1 text-gray-400" />
                            {result.timestamp || 'N/A'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {previewModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm transition-colors duration-200"
          onClick={() => setPreviewModal({ open: false, url: '', isVideo: false })}
          tabIndex={-1}
        >
          <div
            className="relative max-w-3xl w-full max-h-[90vh] flex flex-col items-center justify-center"
            onClick={e => e.stopPropagation()}
            tabIndex={0}
          >
            {previewModal.isVideo ? (
              <video 
                src={previewModal.url} 
                controls 
                autoPlay 
                className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain bg-black"
                style={{ display: 'block', margin: '0 auto' }}
              />
            ) : (
              <img 
                src={previewModal.url} 
                alt="Preview" 
                className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain bg-black"
                style={{ display: 'block', margin: '0 auto' }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttachmentSender;