"use client";
import { useState, useEffect, useCallback } from "react";
import { Truck, Save, Loader2, CheckCircle, Info } from "lucide-react";
import toast from "react-hot-toast";
import { formatPrice } from "@/lib/utils";
import { MAX_DELIVERY_KM } from "@/lib/deliveryPricing";

interface Rates {
  delivery_charge_per_km:    string;
  owner_contribution_per_km: string;
  rider_payout_per_km:       string;
  free_delivery_min_order:   string;
}

const PREVIEW_DISTANCES = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];

export default function DeliveryChargesPage() {
  const [rates, setRates] = useState<Rates>({
    delivery_charge_per_km:    "10",
    owner_contribution_per_km: "5",
    rider_payout_per_km:       "15",
    free_delivery_min_order:   "499",
  });
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [errors,   setErrors]   = useState<Partial<Rates>>({});

  useEffect(() => {
    fetch("/api/restaurant-settings")
      .then(r => r.json())
      .then(d => {
        setRates({
          delivery_charge_per_km:    String(d.delivery_charge_per_km    ?? 10),
          owner_contribution_per_km: String(d.owner_contribution_per_km ?? 5),
          rider_payout_per_km:       String(d.rider_payout_per_km       ?? 15),
          free_delivery_min_order:   String(d.free_delivery_min_order   ?? 499),
        });
      })
      .catch(() => toast.error("Settings load nahi hui"))
      .finally(() => setLoading(false));
  }, []);

  function validate(): boolean {
    const errs: Partial<Rates> = {};
    const fields: (keyof Rates)[] = [
      "delivery_charge_per_km",
      "owner_contribution_per_km",
      "rider_payout_per_km",
      "free_delivery_min_order",
    ];
    for (const f of fields) {
      const v = Number(rates[f]);
      if (rates[f].trim() === "" || isNaN(v)) errs[f] = "Valid number enter karo";
      else if (v < 0)                          errs[f] = "Negative nahi ho sakta";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const handleSave = useCallback(async () => {
    if (!validate()) { toast.error("Pehle errors fix karo"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/restaurant-settings", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delivery_charge_per_km:    Number(rates.delivery_charge_per_km),
          owner_contribution_per_km: Number(rates.owner_contribution_per_km),
          rider_payout_per_km:       Number(rates.rider_payout_per_km),
          free_delivery_min_order:   Number(rates.free_delivery_min_order),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Save failed");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast.success("Delivery charges save ho gaye!");
    } catch (e: any) {
      toast.error(e.message ?? "Save nahi hua");
    } finally {
      setSaving(false);
    }
  }, [rates]);

  const custRate  = Math.max(0, Number(rates.delivery_charge_per_km)    || 0);
  const ownerRate = Math.max(0, Number(rates.owner_contribution_per_km) || 0);
  const riderRate = Math.max(0, Number(rates.rider_payout_per_km)       || 0);
  const freeAt    = Math.max(0, Number(rates.free_delivery_min_order)   || 0);

  function RateField({
    fieldKey, label, hint, color,
  }: { fieldKey: keyof Rates; label: string; hint: string; color: string }) {
    return (
      <div>
        <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
          {label}
        </label>
        <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>{hint}</p>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-sm" style={{ color }}>
            {fieldKey === "free_delivery_min_order" ? "≥ ₹" : "₹"}
          </span>
          <input
            type="number"
            min="0"
            step="0.5"
            value={rates[fieldKey]}
            onChange={e => {
              setRates(p => ({ ...p, [fieldKey]: e.target.value }));
              setErrors(p => ({ ...p, [fieldKey]: undefined }));
              setSaved(false);
            }}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm font-semibold border transition-all outline-none"
            style={{
              background:  "var(--bg-primary)",
              borderColor: errors[fieldKey] ? "#ef4444" : "var(--border)",
              color:       "var(--text-primary)",
            }}
          />
        </div>
        {errors[fieldKey] && (
          <p className="text-red-400 text-xs mt-1">{errors[fieldKey]}</p>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center">
          <Truck size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            Delivery Charges
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Per-km rates set karo — sirf naye orders pe apply hoga
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div
        className="flex gap-3 p-4 rounded-2xl mb-6"
        style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)" }}
      >
        <Info size={18} className="text-orange-400 shrink-0 mt-0.5" />
        <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
          <p className="font-semibold text-orange-400 mb-1">Rates kaise kaam karti hain</p>
          <p>Customer charge = <strong>distance &times; customer rate</strong></p>
          <p>Rider payout = <strong>distance &times; rider rate</strong></p>
          <p>Owner contribution = <strong>distance &times; owner rate</strong></p>
          <p className="mt-1">
            Free delivery threshold cross hone par: customer <strong>₹0</strong> deta hai,
            rider ko pura payout milta hai.
          </p>
        </div>
      </div>

      {/* Per-km rate inputs */}
      <div
        className="rounded-2xl p-6 mb-6"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
      >
        <h2 className="font-bold text-base mb-5" style={{ color: "var(--text-primary)" }}>
          Per-km Rates
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <RateField
            fieldKey="delivery_charge_per_km"
            label="Customer Delivery Charge (₹/km)"
            hint="Customer kya pay karta hai per km"
            color="#f97316"
          />
          <RateField
            fieldKey="owner_contribution_per_km"
            label="Owner Contribution (₹/km)"
            hint="Owner kya cover karta hai per km"
            color="#a855f7"
          />
          <RateField
            fieldKey="rider_payout_per_km"
            label="Rider Payout (₹/km)"
            hint="Rider ko kitna milta hai per km"
            color="#22c55e"
          />
        </div>

        <div
          className="mt-5 pt-5"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <h2 className="font-bold text-base mb-4" style={{ color: "var(--text-primary)" }}>
            Free Delivery Threshold
          </h2>
          <RateField
            fieldKey="free_delivery_min_order"
            label="Minimum Order Value for Free Delivery (₹)"
            hint={`Orders >= Rs.${rates.free_delivery_min_order} par customer se delivery charge nahi liya jayega`}
            color="#3b82f6"
          />
        </div>
      </div>

      {/* Live preview table */}
      <div
        className="rounded-2xl p-6 mb-6"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
      >
        <h2 className="font-bold text-base mb-1" style={{ color: "var(--text-primary)" }}>
          Live Preview
        </h2>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          Jab order subtotal &lt; Rs.{freeAt} ho (free delivery nahi)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Distance", "Customer", "Owner", "Rider"].map(h => (
                  <th
                    key={h}
                    className="text-left pb-2 pr-4 font-semibold text-xs uppercase tracking-wide"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PREVIEW_DISTANCES.filter(d => d <= MAX_DELIVERY_KM).map(d => {
                const cFee  = Math.round(d * custRate);
                const rPay  = Math.round(d * riderRate);
                const oCont = Math.round(d * ownerRate);
                return (
                  <tr key={d} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td className="py-2.5 pr-4 font-semibold" style={{ color: "var(--text-primary)" }}>
                      {d} km
                    </td>
                    <td className="py-2.5 pr-4 font-bold text-orange-400">{formatPrice(cFee)}</td>
                    <td className="py-2.5 pr-4 font-bold text-purple-400">{formatPrice(oCont)}</td>
                    <td className="py-2.5 font-bold text-green-400">{formatPrice(rPay)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div
          className="mt-4 p-3 rounded-xl text-sm"
          style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}
        >
          <p style={{ color: "var(--text-secondary)" }}>
            <span className="text-blue-400 font-bold">Free Delivery (Rs.{freeAt}+):</span>{" "}
            Customer Rs.0 &bull; Rider same payout &bull; Owner waived amount cover karta hai
          </p>
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white transition-all disabled:opacity-60"
        style={{ background: "linear-gradient(135deg,#f97316,#dc2626)" }}
      >
        {saving ? (
          <><Loader2 size={18} className="animate-spin" /> Saving...</>
        ) : saved ? (
          <><CheckCircle size={18} /> Saved!</>
        ) : (
          <><Save size={18} /> Save Delivery Charges</>
        )}
      </button>
    </div>
  );
}
