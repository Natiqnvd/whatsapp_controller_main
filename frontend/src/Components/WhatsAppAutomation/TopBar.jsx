import React, { useState, useEffect } from "react";
import { CreditCard, Mail, Phone, Check, X, Menu, Settings } from "lucide-react";
import { toast } from 'react-toastify';
import axios from "axios";
import { API_ENDPOINTS } from "../../config/api";

const TopBar = ({ activeTab, setActiveTab, adminNumber, setAdminNumber }) => {
  // Remove local adminNumber state - use props instead
  const [tempNumber, setTempNumber] = useState("");   // editable input
  const [isEditing, setIsEditing] = useState(false);
  const [isValidNumber, setIsValidNumber] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Initialize tempNumber when adminNumber prop changes
  useEffect(() => {
    setTempNumber(adminNumber || "");
  }, [adminNumber]);

  // Validate phone number format
  const validatePhoneNumber = (number) => {
    const cleaned = number.replace(/\s/g, ''); // remove all spaces
    const phoneRegex = /^\+?\d{9,14}$/; // optional '+' at the start, followed by 9–14 digits
    return phoneRegex.test(cleaned) || number === '';
  };

  // Fetch admin number from backend
  const fetchAdminNumber = async () => {
    try {
      const response = await axios.get(API_ENDPOINTS.CONTACTS.ADMIN_NUMBER);
      const number = response.data.admin_number || "";
      setAdminNumber(number); // Use prop function instead of local state
      setTempNumber(number);
      localStorage.setItem("admin_number_backup", number);
    } catch (error) {
      console.error("Failed to fetch admin number:", error);
      const fallback = localStorage.getItem("admin_number_backup") || "";
      if (fallback) {
        toast.warning("⚠️ Backend offline. Using saved number.");
        setAdminNumber(fallback); // Use prop function
        setTempNumber(fallback);
      } else {
        toast.error("❌ Could not load admin number.");
      }
    }
  };

  // Fetch admin number on component mount
  useEffect(() => {
    fetchAdminNumber();
  }, []);

  // Responsive screen size tracking
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Handle changes to number input
  const handleNumberChange = (e) => {
    const value = e.target.value;
    setTempNumber(value);
    setIsValidNumber(validatePhoneNumber(value));
  };

  // Save number to API (and fallback)
  const handleSaveNumber = async () => {
    if (!isValidNumber) return;

    try {
      await axios.post(API_ENDPOINTS.CONTACTS.ADMIN_NUMBER, {
        admin_number: tempNumber,
      });
      setAdminNumber(tempNumber); // Use prop function instead of local state
      setIsEditing(false);
      localStorage.setItem("admin_number_backup", tempNumber);
      toast.success("✅ Admin number saved successfully.");
    } catch (error) {
      console.error("Failed to save admin number:", error);
      localStorage.setItem("admin_number_backup", tempNumber);
      setAdminNumber(tempNumber); // Use prop function
      setIsEditing(false);
      toast.warning("⚠️ Backend offline. Number saved locally.");
    }
  };

  const handleCancelEdit = () => {
    setTempNumber(adminNumber); // Use prop value instead of local state
    setIsEditing(false);
    setIsValidNumber(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSaveNumber();
    if (e.key === "Escape") handleCancelEdit();
  };

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    setShowMobileMenu(false);
  };

  const tabs = [
    {
      id: "balances",
      label: "Balance Notifications",
      shortLabel: "Balances",
      icon: CreditCard,
      description: "Monitor account balances"
    },
    {
      id: "contacts",
      label: "Contact Manager",
      shortLabel: "Contacts",
      icon: Phone,
      description: "Manage contact lists"
    },
    {
      id: "attachments",
      label: "Send Attachments",
      shortLabel: "Attachments",
      icon: Mail,
      description: "Manage file attachments"
    }
  ];

  // Rest of the component remains the same...
  // Mobile Layout
  if (isMobile) {
    return (
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 shadow-sm">
        {/* Mobile Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="p-2 rounded-lg bg-white shadow-sm hover:bg-gray-100 transition-colors"
              aria-label="Toggle menu"
            >
              <Menu className="h-5 w-5 text-gray-700" />
            </button>
            
            {/* Current Tab Indicator */}
            <div className="flex items-center space-x-2">
              {tabs.map((tab) => {
                if (tab.id === activeTab) {
                  const Icon = tab.icon;
                  return (
                    <div key={tab.id} className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-full shadow-sm">
                      <Icon className="h-4 w-4 text-gray-700" />
                      <span className="text-sm font-medium text-gray-800">{tab.shortLabel}</span>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>

          {/* Admin Settings Button */}
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="p-2 rounded-lg bg-white shadow-sm hover:bg-gray-100 transition-colors"
            aria-label="Admin settings"
          >
            <Settings className="h-5 w-5 text-gray-700" />
          </button>
        </div>

        {/* Mobile Navigation Menu */}
        {showMobileMenu && (
          <div className="border-t border-gray-200 bg-white shadow-lg">
            <div className="p-4 space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-gray-700 text-white shadow-md"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                    aria-pressed={isActive}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Mobile Admin Number Edit */}
        {isEditing && (
          <div className="border-t border-gray-200 bg-white p-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Phone className="h-4 w-4" />
                <span className="font-medium">Admin Contact Number</span>
              </div>
              
              <div className="space-y-2">
                <input
                  type="tel"
                  value={tempNumber}
                  onChange={handleNumberChange}
                  onKeyDown={handleKeyDown}
                  placeholder="+1234567890"
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-gray-400 focus:border-transparent bg-white text-base transition-all ${
                    isValidNumber 
                      ? "border-gray-300" 
                      : "border-red-300 bg-red-50"
                  }`}
                />
                {!isValidNumber && (
                  <div className="text-sm text-red-600">
                    Please enter a valid phone number
                  </div>
                )}
                
                <div className="flex space-x-2">
                  <button
                    onClick={handleSaveNumber}
                    disabled={!isValidNumber}
                    className="flex-1 flex items-center justify-center space-x-2 py-3 px-4 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Check className="h-4 w-4" />
                    <span>Save</span>
                  </button>
                  
                  <button
                    onClick={handleCancelEdit}
                    className="flex-1 flex items-center justify-center space-x-2 py-3 px-4 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-colors"
                  >
                    <X className="h-4 w-4" />
                    <span>Cancel</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop Layout
  return (
    <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left spacer for balance */}
        <div className="w-64"></div>
        
        {/* Tab Navigation - Centered */}
        <div className="flex items-center space-x-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group relative px-5 py-3 rounded-xl font-medium flex items-center space-x-3 transition-all duration-200 transform hover:scale-105 ${
                  isActive
                    ? "bg-white text-gray-800 shadow-md ring-2 ring-gray-300"
                    : "text-gray-600 hover:bg-white/50 hover:text-gray-800"
                }`}
                aria-pressed={isActive}
                title={tab.description}
              >
                <Icon className={`h-5 w-5 transition-colors ${
                  isActive ? "text-gray-700" : "text-gray-500 group-hover:text-gray-700"
                }`} />
                <span className="whitespace-nowrap">{tab.label}</span>
                
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-700 rounded-full"></div>
                )}
              </button>
            );
          })}
        </div>

        {/* Admin Number Section */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Phone className="h-4 w-4" />
            <span className="font-medium">Admin Contact</span>
          </div>
          
          <div className="relative">
            {isEditing ? (
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <input
                    type="tel"
                    value={tempNumber}
                    onChange={handleNumberChange}
                    onKeyDown={handleKeyDown}
                    placeholder="+1234567890"
                    className={`w-[11rem] sm:w-[9rem] xs:w-[7.5rem] px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent bg-white text-sm transition-all ${
                      isValidNumber 
                        ? "border-gray-300" 
                        : "border-red-300 bg-red-50"
                    }`}
                    autoFocus
                  />
                  {!isValidNumber && (
                    <div className="absolute -bottom-6 left-0 text-xs text-red-600">
                      Invalid phone number
                    </div>
                  )}
                </div>
                
                <button
                  onClick={handleSaveNumber}
                  disabled={!isValidNumber}
                  className="p-1.5 rounded-md bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Save number"
                >
                  <Check className="h-4 w-4" />
                </button>
                
                <button
                  onClick={handleCancelEdit}
                  className="p-1.5 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                  title="Cancel editing"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="group flex items-center space-x-2 px-3 py-2 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200"
                title="Click to edit admin number"
              >
                <span className={`text-sm font-mono ${
                  adminNumber ? "text-gray-800" : "text-gray-400"
                }`}>
                  {adminNumber || "Set admin number"}
                </span>
                <div className="w-2 h-2 bg-gray-400 rounded-full group-hover:bg-gray-600 transition-colors"></div>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopBar;