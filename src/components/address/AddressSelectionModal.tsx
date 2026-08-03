"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import {
  MapPin, Plus, Loader2, CheckCircle, Trash2, Navigation,
  Home, Briefcase, Tag, X, ChevronRight, AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";

// ── Types ────────────────────────────────────────────────────────
interface Address {
  id:            string;
  label:         string;
  address_line1: string;
  address_line2: string | null;
  city:          string;
  state:         string;
  pincode:       string;
  latitude:      number | null;
  longitude:     number | null;
  is_default:    boolean;
}

interface Props {
  onClose: () => void;
}

type Tab = "saved" | "new" | "gps";

// ── Label icons ──────────────────────────────────────────────────
const LABEL_OPTIONS = ["Home", "Work", "Other"];
function LabelIcon({ label }: { label: string }) {
  if (label === "Home")   return <Home size={14} />;
  if (label === "Work")   return <Briefcase size={14} />;
  return <Tag size={14} />;
}

// ── Main Component ───────────────────────────────────────────────
export default function AddressSelectionModal({ onClose }: Props) {
  const { user } = useAuthStore();

  const [addresses,     setAddresses]     = useState<Address[]>([]);
  const [loadingAddrs,  setLoadingAddrs]  = useState(true);
  const [activeTab,     setActiveTab]     = useState<Tab>("saved");
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [deletingId,    setDeletingId]    = useState<string | null>(null);

  // New/Edit form
  const [editMode,  setEditMode]  = useState(false);
  const [editId,    setEditId]    = useState<string | null>(null);
  const [label,     setLabel]     = useState("Home");
  const [line1,     setLine1]     = useState("");
  const [line2,     setLine2]     = useState("");
  const [city,      setCity]      = useState("");
  const [state,     setState]     = useState("");
  const [pincode,   setPincode]   = useState("");
  const [savingNew, setSavingNew] = useState(false);

  // GPS
  const [gpsLoading,   setGpsLoading]   = useState(false);
  const [gpsAddress,   setGpsAddress]   = useState<Partial<Address> | null>(null);
  const [gpsSaving,    setGpsSaving]    = useState(false);
  const [gpsLat,       setGpsLat]       = useState<number | null>(null);
  const [gpsLng,       setGpsLng]       = useState<number | null>(null);

  // ── Load saved addresses ────────────────────────────────────────
  const loadAddresses = useCallback(async () => {
    if (!user) return;
    setLoadingAddrs(true);
    const { data, error } = await supabase
      .from("addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (!error && data) {
      setAddresses(data as Address[]);
      // auto-select default
      const def = (data as Address[]).find((a) => a.is_default);
      if (def) setSelectedId(def.id);
    }
    setLoadingAddrs(false);
  }, [user]);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  // Switch to "saved" tab if addresses load and exist
  useEffect(() => {
    if (!loadingAddrs && addresses.length === 0) setActiveTab("new");
    else if (!loadingAddrs && addresses.length > 0) setActiveTab("saved");
  }, [loadingAddrs]);

  // ── Select & confirm ────────────────────────────────────────────
  async function confirmSelection() {
    if (!selectedId || !user) return;
    // Mark selected as default
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
    await supabase.from("addresses").update({ is_default: true  }).eq("id", selectedId);
    onClose();
  }

  // ── Delete address ──────────────────────────────────────────────
  async function deleteAddress(id: string) {
    if (!user) return;
    setDeletingId(id);
    const { error } = await supabase.from("addresses").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete address");
    } else {
      toast.success("Address deleted");
      if (selectedId === id) setSelectedId(null);
      await loadAddresses();
    }
    setDeletingId(null);
  }

  // ── Set default ─────────────────────────────────────────────────
  async function setDefault(id: string) {
    if (!user) return;
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
    await supabase.from("addresses").update({ is_default: true  }).eq("id", id);
    await loadAddresses();
  }

  // ── Start edit ──────────────────────────────────────────────────
  function startEdit(a: Address) {
    setEditMode(true); setEditId(a.id);
    setLabel(a.label); setLine1(a.address_line1);
    setLine2(a.address_line2 ?? ""); setCity(a.city);
    setState(a.state); setPincode(a.pincode);
    setActiveTab("new");
  }

  function resetForm() {
    setEditMode(false); setEditId(null);
    setLabel("Home"); setLine1(""); setLine2("");
    setCity(""); setState(""); setPincode("");
  }

  // ── Save new / update address ───────────────────────────────────
  async function saveAddress() {
    if (!user) return;
    if (!line1.trim() || !city.trim() || !state.trim() || !pincode.trim()) {
      toast.error("Please fill all required fields");
      return;
    }
    setSavingNew(true);

    // Geocode the address via server-side /api/geocode (Google → Nominatim fallback)
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const geoRes = await fetch("/api/geocode", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ line1: line1.trim(), city: city.trim(), state: state.trim(), pincode: pincode.trim() }),
        signal:  AbortSignal.timeout(12000),
      });
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (geoData.lat && geoData.accuracy) {
          lat = geoData.lat;
          lng = geoData.lng;
        }
      }
    } catch { /* geocoding failure — save without coords, auto-geocode at selection time */ }

    const payload = {
      user_id: user.id,
      label, address_line1: line1.trim(),
      address_line2: line2.trim() || null,
      city: city.trim(), state: state.trim(), pincode: pincode.trim(),
      latitude:  lat,
      longitude: lng,
      is_default: addresses.length === 0,
    };

    let savedId: string | null = null;
    if (editMode && editId) {
      const { data, error } = await supabase.from("addresses")
        .update({
          label, address_line1: line1.trim(), address_line2: line2.trim() || null,
          city: city.trim(), state: state.trim(), pincode: pincode.trim(),
          latitude: lat, longitude: lng,
        })
        .eq("id", editId).select("id").single();
      if (error) { toast.error("Failed to update: " + error.message); }
      else { savedId = data.id; toast.success(lat ? "Address updated & verified ✅" : "Address updated ✅"); }
    } else {
      const { data, error } = await supabase.from("addresses").insert(payload).select("id").single();
      if (error) { toast.error("Failed to save: " + error.message); }
      else { savedId = data.id; toast.success(lat ? "Address saved & verified ✅" : "Address saved ✅"); }
    }

    setSavingNew(false);
    if (savedId) {
      resetForm();
      await loadAddresses();
      setSelectedId(savedId);
      setActiveTab("saved");
    }
  }

  // ── GPS Location ────────────────────────────────────────────────
  async function getGpsLocation() {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported by your browser");
      return;
    }
    setGpsLoading(true); setGpsAddress(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setGpsLat(lat); setGpsLng(lng);
        try {
          // Use server-side reverse-geocode endpoint (tries Google first, then Nominatim)
          // This gives proper Indian street names instead of generic area names
          const res  = await fetch("/api/reverse-geocode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat, lng }),
          });
          const data = await res.json();
          setGpsAddress({
            label:         "Current Location",
            address_line1: data.address_line1 || "GPS Location",
            address_line2: data.address_line2 || null,
            city:          data.city          || "",
            state:         data.state         || "",
            pincode:       data.pincode        || "",
          });
        } catch {
          toast.error("Could not fetch address. Please enter manually.");
        }
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        const msgs: Record<number, string> = {
          1: "Location permission denied. Please allow access.",
          2: "Location unavailable. Try again.",
          3: "Location request timed out.",
        };
        toast.error(msgs[err.code] ?? "Failed to get location");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }


  async function saveGpsAddress() {
    if (!user || !gpsAddress) return;
    if (!gpsAddress.city || !gpsAddress.state) {
      toast.error("Could not fully resolve address. Please fill manually.");
      return;
    }
    setGpsSaving(true);
    const payload = {
      user_id: user.id,
      label:         "Current Location",
      address_line1: gpsAddress.address_line1 || "GPS Location",
      address_line2: gpsAddress.address_line2 || null,
      city:          gpsAddress.city,
      state:         gpsAddress.state,
      pincode:       gpsAddress.pincode || "",
      latitude:      gpsLat,
      longitude:     gpsLng,
      is_default:    addresses.length === 0,
    };
    const { data, error } = await supabase.from("addresses").insert(payload).select("id").single();
    if (error) {
      toast.error("Failed to save: " + error.message);
    } else {
      toast.success("Location saved! ✅");
      setGpsAddress(null); setGpsLat(null); setGpsLng(null);
      await loadAddresses();
      setSelectedId(data.id);
      setActiveTab("saved");
    }
    setGpsSaving(false);
  }

  // ── Can close ───────────────────────────────────────────────────
  const canClose = addresses.length > 0;

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}>

      <div className="relative w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: "#0f0f14", border: "1px solid rgba(249,115,22,0.2)" }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "linear-gradient(135deg,rgba(249,115,22,0.12),rgba(220,38,38,0.06))" }}>
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-orange-400" />
            <span className="font-bold text-base text-white" style={{ fontFamily: "'Outfit',sans-serif" }}>
              Select Delivery Address
            </span>
          </div>
          {canClose && (
            <button onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all">
              <X size={15} />
            </button>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          {([
            { id: "saved" as Tab, label: "Saved", icon: "📋" },
            { id: "new"   as Tab, label: "Add New", icon: "➕" },
            { id: "gps"   as Tab, label: "Use GPS", icon: "📍" },
          ]).map(({ id, label, icon }) => (
            <button key={id} onClick={() => { setActiveTab(id); if (id === "new") resetForm(); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-all"
              style={{
                color:         activeTab === id ? "#f97316" : "#6b7280",
                borderBottom:  activeTab === id ? "2px solid #f97316" : "2px solid transparent",
                background:    activeTab === id ? "rgba(249,115,22,0.06)" : "transparent",
              }}>
              {icon} {label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ─── SAVED ADDRESSES ─── */}
          {activeTab === "saved" && (
            <div className="p-4 space-y-3">
              {loadingAddrs ? (
                <div className="flex items-center justify-center py-10 text-gray-500 gap-2">
                  <Loader2 size={18} className="animate-spin" /> Loading addresses...
                </div>
              ) : addresses.length === 0 ? (
                <div className="text-center py-10">
                  <MapPin size={36} className="text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-400 font-semibold mb-1">No saved addresses</p>
                  <p className="text-gray-600 text-sm">Add your first delivery address below</p>
                </div>
              ) : (
                addresses.map((addr) => {
                  const isSelected = selectedId === addr.id;
                  return (
                    <div key={addr.id}
                      onClick={() => setSelectedId(addr.id)}
                      className="relative rounded-xl p-4 cursor-pointer transition-all"
                      style={{
                        background: isSelected ? "rgba(249,115,22,0.1)" : "rgba(255,255,255,0.03)",
                        border:     isSelected ? "1.5px solid rgba(249,115,22,0.5)" : "1px solid rgba(255,255,255,0.07)",
                      }}>

                      <div className="flex items-start gap-3">
                        {/* Selection indicator */}
                        <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center"
                          style={{ borderColor: isSelected ? "#f97316" : "#374151", background: isSelected ? "#f97316" : "transparent" }}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Label + default badge */}
                          <div className="flex items-center gap-2 mb-1">
                            <span className="flex items-center gap-1 text-xs font-bold text-orange-400">
                              <LabelIcon label={addr.label} /> {addr.label}
                            </span>
                            {addr.is_default && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                                style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
                                Default
                              </span>
                            )}
                          </div>

                          <p className="text-sm text-white font-medium leading-snug">
                            {addr.address_line1}
                          </p>
                          {addr.address_line2 && (
                            <p className="text-xs text-gray-500">{addr.address_line2}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-0.5">
                            {addr.city}, {addr.state} — {addr.pincode}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        <button onClick={(e) => { e.stopPropagation(); startEdit(addr); }}
                          className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                          ✏️ Edit
                        </button>
                        {!addr.is_default && (
                          <button onClick={(e) => { e.stopPropagation(); setDefault(addr.id); }}
                            className="text-xs text-gray-500 hover:text-green-400 transition-colors">
                            ⭐ Set Default
                          </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); deleteAddress(addr.id); }}
                          disabled={deletingId === addr.id}
                          className="ml-auto text-xs text-gray-600 hover:text-red-400 transition-colors disabled:opacity-50">
                          {deletingId === addr.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}

              {addresses.length > 0 && (
                <button onClick={() => { setActiveTab("new"); resetForm(); }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm text-gray-400 hover:text-orange-400 transition-colors"
                  style={{ border: "1px dashed rgba(255,255,255,0.1)" }}>
                  <Plus size={14} /> Add Another Address
                </button>
              )}
            </div>
          )}

          {/* ─── ADD NEW ADDRESS ─── */}
          {activeTab === "new" && (
            <div className="p-4 space-y-4">
              {editMode && (
                <div className="flex items-center gap-2 text-xs text-orange-400 px-1">
                  <AlertCircle size={13} /> Editing: {label}
                </div>
              )}

              {/* Label selector */}
              <div>
                <label className="text-xs text-gray-500 mb-2 block">Address Label</label>
                <div className="flex gap-2">
                  {LABEL_OPTIONS.map((l) => (
                    <button key={l} onClick={() => setLabel(l)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                      style={{
                        background: label === l ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
                        border:     label === l ? "1.5px solid rgba(249,115,22,0.5)" : "1px solid rgba(255,255,255,0.08)",
                        color:      label === l ? "#f97316" : "#6b7280",
                      }}>
                      <LabelIcon label={l} /> {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* House/Flat/Street */}
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">House / Flat / Street <span className="text-red-400">*</span></label>
                <input value={line1} onChange={(e) => setLine1(e.target.value)}
                  placeholder="e.g. 42, Shivam Nagar, MG Road"
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500/50" />
              </div>

              {/* Landmark */}
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Landmark <span className="text-gray-600">(optional)</span></label>
                <input value={line2} onChange={(e) => setLine2(e.target.value)}
                  placeholder="e.g. Near Big Bazaar"
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500/50" />
              </div>

              {/* City + State */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">City <span className="text-red-400">*</span></label>
                  <input value={city} onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Prayagraj"
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500/50" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">State <span className="text-red-400">*</span></label>
                  <input value={state} onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. UP"
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500/50" />
                </div>
              </div>

              {/* Pincode */}
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Pincode <span className="text-red-400">*</span></label>
                <input value={pincode} onChange={(e) => setPincode(e.target.value)} maxLength={6}
                  placeholder="e.g. 211001"
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500/50" />
              </div>

              <div className="flex gap-3 pt-1">
                {editMode && (
                  <button onClick={() => { resetForm(); setActiveTab("saved"); }}
                    className="px-4 py-3 rounded-xl text-sm text-gray-400 hover:text-white border border-white/10 transition-all">
                    Cancel
                  </button>
                )}
                <button onClick={saveAddress} disabled={savingNew}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white gradient-brand transition-all hover:opacity-90 disabled:opacity-60">
                  {savingNew ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                  {savingNew ? "Saving..." : editMode ? "Update Address" : "Save Address"}
                </button>
              </div>
            </div>
          )}

          {/* ─── GPS LOCATION ─── */}
          {activeTab === "gps" && (
            <div className="p-4">
              {!gpsAddress ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                    style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.2)" }}>
                    <Navigation size={28} className="text-orange-400" />
                  </div>
                  <p className="text-white font-semibold mb-1">Use Your Current Location</p>
                  <p className="text-gray-500 text-sm mb-6 px-4">
                    We'll detect your GPS coordinates and convert them into your delivery address
                  </p>
                  <button onClick={getGpsLocation} disabled={gpsLoading}
                    className="mx-auto flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white gradient-brand transition-all hover:opacity-90 disabled:opacity-60">
                    {gpsLoading
                      ? <><Loader2 size={16} className="animate-spin" /> Detecting Location...</>
                      : <><Navigation size={16} /> Detect My Location</>}
                  </button>
                  <p className="text-gray-600 text-xs mt-4">Your browser will ask for location permission</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl p-4" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
                    <div className="flex items-start gap-3">
                      <CheckCircle size={18} className="text-green-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-white mb-0.5">Location Detected</p>
                        <p className="text-sm text-gray-300">{gpsAddress.address_line1}</p>
                        {gpsAddress.address_line2 && <p className="text-xs text-gray-500">{gpsAddress.address_line2}</p>}
                        <p className="text-xs text-gray-500 mt-0.5">
                          {gpsAddress.city}, {gpsAddress.state} {gpsAddress.pincode}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => { setGpsAddress(null); setGpsLat(null); setGpsLng(null); }}
                      className="px-4 py-3 rounded-xl text-sm text-gray-400 hover:text-white border border-white/10 transition-all">
                      Retry
                    </button>
                    <button onClick={saveGpsAddress} disabled={gpsSaving}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white gradient-brand transition-all hover:opacity-90 disabled:opacity-60">
                      {gpsSaving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                      {gpsSaving ? "Saving..." : "Use This Address"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer: Confirm button (only on saved tab with selection) ── */}
        {activeTab === "saved" && selectedId && addresses.length > 0 && (
          <div className="px-4 pb-4 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <button onClick={confirmSelection}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-base font-bold text-white gradient-brand transition-all hover:opacity-90">
              <ChevronRight size={18} /> Deliver Here — Continue
            </button>
          </div>
        )}

        {/* ── No address warning ── */}
        {!canClose && activeTab !== "saved" && (
          <div className="px-4 pb-3">
            <p className="text-center text-xs text-gray-600">
              Please add an address to proceed with ordering
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
