"use client";

import { useState, useRef, useEffect } from "react";
import { X, Mic, StopCircle, Paperclip, UploadCloud, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import toast from "react-hot-toast";

type UserType = "customer" | "rider" | "owner";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userType: UserType;
  defaultName?: string;
  defaultEmail?: string;
  defaultPhone?: string;
}

const CATEGORIES = [
  "Order Issue",
  "Payment Issue",
  "Delivery Issue",
  "Account/Login Issue",
  "Refund Issue",
  "Rider Issue",
  "Restaurant Issue",
  "Technical Problem",
  "Other"
];

export default function SupportTicketModal({ isOpen, onClose, userType, defaultName = "", defaultEmail = "", defaultPhone = "" }: Props) {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState(defaultPhone);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successTicketId, setSuccessTicketId] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setName(defaultName);
    setEmail(defaultEmail);
    setPhone(defaultPhone);
  }, [defaultName, defaultEmail, defaultPhone]);

  useEffect(() => {
    if ("webkitSpeechRecognition" in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setDescription((prev) => (prev ? prev + " " + finalTranscript : finalTranscript));
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
        toast.error("Speech recognition failed.");
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      if (!recognitionRef.current) {
        toast.error("Speech recognition not supported in your browser.");
        return;
      }
      setDescription(""); // Optional: clear existing or keep appending
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      // Validate sizes (e.g. 5MB max)
      const validFiles = selectedFiles.filter(f => f.size <= 5 * 1024 * 1024);
      if (validFiles.length < selectedFiles.length) {
        toast.error("Some files were too large (max 5MB).");
      }
      setFiles((prev) => [...prev, ...validFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !email.trim() || !description.trim()) {
      toast.error("Please fill all required fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Upload Attachments
      const uploadedUrls: string[] = [];
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${userType}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('support_attachments')
          .upload(filePath, file);
          
        if (uploadError) {
          console.error("Upload Error:", uploadError);
          // If bucket doesn't exist, ignore upload failure for now so ticket creation can proceed in dev
          toast.error("Failed to upload " + file.name + ". Skipping file.");
        } else {
          const { data } = supabase.storage.from('support_attachments').getPublicUrl(filePath);
          uploadedUrls.push(data.publicUrl);
        }
      }

      // 2. Insert Ticket via server-side API (bypasses RLS infinite recursion)
      const ticketRes  = await fetch("/api/support/ticket", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name:        name.trim(),
          phone:       phone.trim(),
          email:       email.trim(),
          userType,
          category,
          description: description.trim(),
          attachments: uploadedUrls,
        }),
      });
      const ticketJson = await ticketRes.json();
      if (!ticketRes.ok) {
        throw new Error(ticketJson.error ?? "Failed to submit ticket");
      }
      const ticket = ticketJson.ticket;

      // 3. Trigger Email API
      await fetch('/api/support/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: ticket.id,
          name, phone, email, userType, category, description, attachments: uploadedUrls
        })
      });

      setSuccessTicketId(ticket.id);
      
    } catch (error: any) {
      console.error("[SupportTicketModal] Submit failed:", {
        message: error?.message,
        code:    error?.code,
        details: error?.details,
        hint:    error?.hint,
        raw:     error,
      });
      toast.error(error.message || "Failed to submit ticket.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setSuccessTicketId(null);
    setDescription("");
    setFiles([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">Help & Support</h2>
          <button onClick={handleResetAndClose} className="p-2 text-gray-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto custom-scrollbar">
          {successTicketId ? (
            <div className="text-center py-10">
              <CheckCircle2 size={64} className="text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Request Submitted Successfully</h3>
              <p className="text-gray-400 mb-6">Your support request has been recorded. Our team will get back to you shortly.</p>
              
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-8 text-left inline-block">
                <p className="text-sm text-gray-400 mb-1">Ticket ID:</p>
                <p className="font-mono text-white select-all">{successTicketId}</p>
                <p className="text-sm text-gray-400 mt-3 mb-1">Current Status:</p>
                <p className="text-orange-400 font-semibold">Open</p>
              </div>

              <button onClick={handleResetAndClose} className="w-full py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition">
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Full Name</label>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Mobile Number</label>
                  <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Email Address</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Issue Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 appearance-none">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-end mb-1.5">
                  <label className="block text-xs font-semibold text-gray-400 uppercase">Problem Description</label>
                  <button type="button" onClick={toggleRecording} 
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition ${isRecording ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}>
                    {isRecording ? <><StopCircle size={14} className="animate-pulse" /> Recording...</> : <><Mic size={14} /> Dictate</>}
                  </button>
                </div>
                <textarea required rows={4} value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Describe your issue in detail..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 resize-none" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Attachments (Optional)</label>
                <div className="border-2 border-dashed border-white/10 rounded-xl p-4 text-center hover:border-white/20 transition cursor-pointer relative">
                  <input type="file" multiple accept="image/*,video/*,.pdf" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <UploadCloud size={24} className="text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Click or drag files here to upload</p>
                  <p className="text-xs text-gray-500 mt-1">JPG, PNG, MP4, PDF (Max 5MB)</p>
                </div>
                
                {files.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {files.map((file, i) => (
                      <div key={i} className="flex justify-between items-center bg-white/5 p-2 rounded-lg border border-white/10">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Paperclip size={14} className="text-orange-400 shrink-0" />
                          <span className="text-xs text-gray-300 truncate">{file.name}</span>
                        </div>
                        <button type="button" onClick={() => removeFile(i)} className="p-1 hover:bg-red-500/20 text-red-400 rounded transition">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button type="submit" disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white gradient-brand transition-all hover:opacity-90 disabled:opacity-70 mt-2">
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : "Submit Ticket"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
