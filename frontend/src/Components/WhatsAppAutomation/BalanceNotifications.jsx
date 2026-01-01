import React from 'react';
import { Send, Loader2, AlertCircle, CheckCircle, XCircle, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tab';
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { API_ENDPOINTS } from "../../config/api";
import ErrorCard from '../ui/ErrorCard';

const BalanceNotifications = ({ state, updateState, adminNumber }) => {
  const {
    selectedFile,
    csvData,
    csvTextArea,
    results,
    isLoading,
    error,
    message,
    preview,
    totalContacts,
    processedCount,
  } = state;

  const applyWhatsAppFormatting = (text) => {
    return text
      .replace(/\*([^*]+)\*/g, "<strong>$1</strong>")
      .replace(/_([^_]+)_/g, "<em>$1</em>")
      .replace(/~([^~]+)~/g, "<del>$1</del>")
      .replace(/([^]+)/g, "<code>$1</code>")
      .replace(/\n/g, "<br />");
  };

  const updatePreview = (template, sampleData) => {
    try {
      let previewMessage = template
        .replace(/{name}/g, sampleData.name || "John Doe")
        .replace(/{balance}/g, sampleData.balance || 0);
      updateState({ preview: applyWhatsAppFormatting(previewMessage) });
    } catch (err) {
      updateState({ preview: "Invalid template." });
    }
  };

  const parseCSVData = (csvText) => {
    try {
      const lines = csvText.trim().split('\n');

      if (lines.length === 1 && lines[0].trim() || lines.length === 2) {
        return [];
      }

      if (lines.length < 2) {
        throw new Error("CSV must contain headers and at least one row of data.");
      }
  
      // Parse and validate headers
      const headers = lines[0].toLowerCase().split(',').map((h) => h.trim());
      const requiredHeaders = ['name', 'balance', 'number'];
      const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
  
      if (missingHeaders.length > 0) {
        throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
      }
  
      // Validate rows
      const data = lines.slice(1).map((line, index) => {
        const values = line.split(',').map((v) => v.trim());
        if (values.length !== headers.length) {
          throw new Error(
            `Row ${index + 2} does not have the same number of fields as the headers.`
          );
        }
  
        const row = {};
        headers.forEach((header, i) => {
          let value = values[i] || '';
          switch (header) {
            case 'name':
              // Capitalize the first letter of the name
              value = value
                .toLowerCase()
                .replace(/\b\w/g, (char) => char.toUpperCase());
              break;
            case 'balance':
              // Remove decimals and convert to integer
              value = Math.floor(parseFloat(value)) || 0;
              break;
            default:
              break;
          }
          row[header] = value;
        });
        return row;
      });
  
      return data;
    } catch (err) {
      throw new Error(
        `Invalid CSV format: ${err.message}. Please ensure your data has proper headers and rows.`
      );
    }
  };

  const handleCSVPaste = (event) => {
    const csvText = event.target.value;
    
    updateState({ csvTextArea: csvText });

    try {
      if (!csvText.trim()) {
        updateState({
          csvData: [],
          totalContacts: 0,
          error: "",
        });
        return;
      }

      const parsedData = parseCSVData(csvText);

      updateState({
        csvData: parsedData,
        totalContacts: parsedData.length,
        error: "",
      });

      if (parsedData.length > 0) {
        updatePreview(message, parsedData[0]);
      }
    } catch (err) {
      updateState({
        error: err.message,
        csvData: [],
        totalContacts: 0,
      });
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(API_ENDPOINTS.UPLOAD_CSV_BALANCES, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result = await response.json();
      
      if (!result.data || !Array.isArray(result.data)) {
        throw new Error("Invalid data format received from server");
      }

      updateState({
        csvData: result.data,
        totalContacts: result.data.length,
        selectedFile: file,
        error: ""
      });
      
      if (result.data.length > 0) {
        updatePreview(message, result.data[0]);
      }
    } catch (err) {
      updateState({
        error: "Error uploading CSV: " + err.message,
        csvData: [],
        totalContacts: 0,
        selectedFile: null
      });
    }
  };

const handleSendMessages = async () => {
  if (!message.trim().includes("{name}") || !message.trim().includes("{balance}")) {
    updateState({ error: "Message template must include {name} and {balance} placeholders." });
    return;
  }

  // Validate admin number
  if (!adminNumber || !adminNumber.trim()) {
    updateState({ error: "Admin number is required." });
    return;
  }

  updateState({ isLoading: true, error: "", processedCount: 0, results: [] });

  try {
    const response = await fetch(API_ENDPOINTS.SEND_BALANCES, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: csvData.map(row => ({
          ...row,
          messageTemplate: message,
        })),
        admin_no: adminNumber.trim()
      }),
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
    updateState({ error: "Error sending messages: " + err.message });
  } finally {
    updateState({ isLoading: false });
  }
};

  const handleDownloadPDF = () => {
    if (results.length === 0) {
      alert("No results to download.");
      return;
    }
  
    const doc = new jsPDF();
    
    // Title with Styling
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("WhatsApp Balance Sender - Detailed Report", 105, 20, { align: "center" });
  
    // Line separator
    doc.setDrawColor(0, 0, 0);
    doc.line(20, 25, 190, 25);
  
    // Summary Section
    const successful = results.filter(r => r.status === "success").length;
    const failed = results.filter(r => r.status === "error").length;
    const successRate = Math.round((successful / results.length) * 100);
  
    doc.setFontSize(12);
    doc.setTextColor(40);
  
    // Labels for Summary Section
    const summaryX = 20;
    const summaryY = 40;
    const lineHeight = 10;
  
    doc.text(`Total Processed:`, summaryX, summaryY);
    doc.text(`Successful:`, summaryX, summaryY + lineHeight);
    doc.text(`Failed:`, summaryX, summaryY + lineHeight * 2);
    doc.text(`Success Rate:`, summaryX, summaryY + lineHeight * 3);
  
    // Values for Summary Section
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 150);
  
    doc.text(`${results.length}`, summaryX + 60, summaryY);
    doc.text(`${successful}`, summaryX + 60, summaryY + lineHeight);
    doc.text(`${failed}`, summaryX + 60, summaryY + lineHeight * 2);
    doc.text(`${successRate}%`, summaryX + 60, summaryY + lineHeight * 3);
  
    // Table with enhanced styling
    doc.autoTable({
      startY: summaryY + lineHeight * 5,
      headStyles: { fillColor: [22, 160, 133], textColor: 255, fontSize: 10 },
      bodyStyles: { fontSize: 9, textColor: [50, 50, 50] },
      alternateRowStyles: { fillColor: [240, 240, 240] },
      margin: { left: 20, right: 20 },
      head: [["Status", "Name", "Number", "Balance", "Message", "Timestamp"]],
      body: results.map(r => [
        r.status === "success" ? "Sent" : r.status.replace("Skipped-", ""),
        r.name || "N/A",
        r.number || "N/A",
        `Rs. ${r.balance || "0.00"}`,
        r.message || "No Message",
        r.timestamp || "N/A",
      ]),
    });
  
    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(
      "Generated by WhatsApp Balance Sender - Natiqnvd",
      105,
      pageHeight - 10,
      { align: "center" }
    );
  
    // Save the PDF
    doc.save("whatsapp-balance-report.pdf");
  };


  const getStatusIcon = (status) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-yellow-500" />; 
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <h1 className="text-4xl font-extrabold mb-6 text-center w-full">
        Balance Notification
      </h1>
      {isLoading && (
        <div className="flex items-center space-x-2">
          <Loader2 className="animate-spin h-5 w-5" />
          <span>{processedCount}/{totalContacts} Processed</span>
        </div>
      )}

      {error && <ErrorCard error={error} />}

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Add Contact List</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="paste" className="w-full">
              <TabsList className="grid grid-cols-2 gap-4 mb-6">
                <TabsTrigger value="paste">Paste CSV</TabsTrigger>
                <TabsTrigger value="upload">Upload File</TabsTrigger>
              </TabsList>
              
              <TabsContent value="paste">
              <div className="space-y-2">
                <div className="text-sm text-gray-600 mb-2 mt-2">
                  Paste your CSV data with headers: name, balance, number
                </div>
                <textarea
                  rows={8}
                  value={csvTextArea}
                  onChange={handleCSVPaste}
                  placeholder="name,balance,number&#10;John Doe,1000,1234567890&#10;Jane Smith,2000,9876543210"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                >
                </textarea>
                <div className="text-xs text-gray-500">
                  Example format:
                  <pre className="mt-1 bg-gray-50 p-2 rounded">
                    name,balance,number{'\n'}
                    John Doe,1000,0345678901{'\n'}
                    Jane Smith,2000,3456789012
                  </pre>
                </div>
              </div>
            </TabsContent>

              <TabsContent value="upload">
                <div className="space-y-4">
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-64 mt-4 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <svg className="w-8 h-8 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                          <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                        </svg>
                        <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                        <p className="text-xs text-gray-500">CSV file only</p>
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept=".csv"
                        onChange={handleFileUpload}
                      />
                    </label>
                  </div>
                  {selectedFile && (
                    <div className="text-sm text-gray-600">
                      Selected file: {selectedFile.name}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {csvData.length > 0 && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>2. Configure Message</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Message Template
                    </label>
                    <textarea
                      rows={5}
                      value={message}
                      onChange={(e) => {
                        updateState({message: e.target.value});
                        updatePreview(e.target.value, csvData[0] || {});
                      }}
                      placeholder="Enter your message template. Use {name} for customer name and {balance} for balance amount."
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="bg-gray-100 p-4 rounded-md">
                    <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
                    <p className="text-lg font-arial" dangerouslySetInnerHTML={{ __html: preview }} />
                  </div>
                    <Button onClick={handleSendMessages} disabled={isLoading} className="w-full">
                        {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing... {processedCount}/{totalContacts}
                        </>
                        ) : (
                        <>
                            <Send className="mr-2 h-4 w-4" />
                            Send Balance Notifications
                        </>
                        )}
                    </Button>

                  {/* Contact List Table */}
                  <div className="mt-6">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Uploaded Contacts</h3>
                    <div className="border rounded-lg">
                      <div className="bg-gray-50 px-6 py-3 border-b">
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Name</div>
                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Number</div>
                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</div>
                        </div>
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {csvData.map((row, index) => (
                          <div
                            key={index}
                            className="px-6 py-3 grid grid-cols-3 gap-4 hover:bg-gray-50 border-b last:border-b-0"
                          >
                            <div className="text-sm text-gray-900 truncate">{row.name}</div>
                            <div className="text-sm text-gray-900 truncate">{row.number}</div>
                            <div className="text-sm text-gray-900">Rs. {row.balance}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 mt-2">
                      Total Contacts: {csvData.length}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Results Section */}
            {results.length > 0 && (
              <Card>
                <CardContent>
                <Button 
                        onClick={handleDownloadPDF} 
                        variant="outline" 
                        className="w-full flex items-center justify-center mt-4">
                        <Download className="mr-2 h-4 w-4" />
                        Download Results as PDF
                </Button>
              <div className="mt-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-center gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-500">Total Processed</p>
                        <p className="mt-1 text-2xl font-semibold text-center text-gray-900">{results.length}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Successful</p>
                        <p className="mt-1 text-2xl text-center font-semibold text-green-600">
                          {results.filter(r => r.status === "success").length}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Invalid Numbers</p>
                        <p className="mt-1 text-2xl text-center font-semibold text-red-600">
                          {results.filter(r => r.status === "Skipped Invalid Number").length}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">No Number</p>
                        <p className="mt-1 text-2xl text-center font-semibold text-red-600">
                          {results.filter(r => r.status === "Skipped No Number").length}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Failed</p>
                        <p className="mt-1 text-2xl text-center font-semibold text-red-600">
                          {results.filter(r => r.status === "error").length}
                        </p>
                      </div>
                    </div>
                  <div className="overflow-x-auto mt-4">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Number</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {results.map((result, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-4">
                              <div className="flex items-center">
                                {getStatusIcon(result.status)}
                                <span className="ml-2 text-sm text-gray-600">
                                  {result.status === "success" ? "Sent" : "Failed"}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">{result.name}</td>
                            <td className="px-4 py-4 whitespace-nowrap">{result.number}</td>
                            <td className="px-4 py-4 whitespace-nowrap">Rs. {result.balance}</td>
                            <td className="px-4 py-4">
                              <div className="max-w-md text-sm text-gray-900">{result.message}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div className="flex items-center">
                              <span className="h-4 w-4 mr-2 text-gray-400">🕒</span>
                            {result.timestamp || 'N/A'}
                           </div>
                          </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BalanceNotifications;