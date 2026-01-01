// WhatsAppAutomation/index.jsx
import React, { useState } from "react";
import TopBar from "./TopBar"; // (formerly Sidebar)
import BalanceNotifications from "./BalanceNotifications";
import AttachmentSender from "./AttachmentSender";
import ContactManager from "./ContactManager";

const WhatsAppController = () => {
  const [activeTab, setActiveTab] = useState("balances");
  const [adminNumber, setAdminNumber] = useState("");

  // Shared state
  const [balanceState, setBalanceState] = useState({
    selectedFile: null,
    csvData: [],
    csvTextArea:"Name,Balance,Number",
    results: [],
    isLoading: false,
    isPaused: false,
    isCancelled: false,
    error: "",
    message: "{name}\nCurrent balance: Rs. {balance}\n*بقایا رقم*: Rs. {balance}\n*نوید سنز* بابو بازار صدر\n*NAVEED SONS* - Babu Bazaar, Saddar",
    preview: "",
    totalContacts: 0,
    processedCount: 0
  });

  const [attachmentState, setAttachmentState] = useState({
    csvData: [],
    selectedMedia: [],
    selectedPDFs: [],
    pdfPaths: [],
    pdfPreviews: [],
    mediaPreviews: [],
    mediaPaths: [],
    message: '',
    isLoading: false,
    error: '',
    results: [],
    processedCount: 0,
    totalContacts: 0
  });

  const [contactState, setContactState] = useState({
    contacts: [],
    isLoading: false,
    error: '',
    success: ''
  });

  const updateBalanceState = (updates) => {
    setBalanceState(prev => ({
      ...prev,
      ...updates
    }));
  };

  const updateAttachmentState = (updates) => {
    setAttachmentState(prev => ({
      ...prev,
      ...updates
    }));
  };

  const updateContactState = (updates) => {
    setContactState(prev => ({
      ...prev,
      ...updates
    }));
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <TopBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        adminNumber={adminNumber}
        setAdminNumber={setAdminNumber} 
      />
      <div className="flex-1 flex flex-col">
        {activeTab === "balances" ? (
          <BalanceNotifications
            state={balanceState}
            updateState={updateBalanceState}
            adminNumber={adminNumber}
          />
        ) : activeTab === "contacts" ? (
          <ContactManager
            state={contactState}
            updateState={updateContactState}
            adminNumber={adminNumber}
          />
        ) : (
          <AttachmentSender
            state={attachmentState}
            updateState={updateAttachmentState}
            adminNumber={adminNumber}
          />
        )}
      </div>
    </div>
  );
};

export default WhatsAppController;