// ============================================================
// DATABASE TYPES — Auto-generated shape for Supabase tables
// ============================================================

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type OrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "picked_up" | "delivered" | "cancelled";
export type PaymentStatus = "pending" | "paid" | "failed";
export type PaymentMethod = "razorpay" | "cash_on_delivery";
export type DeliveryStatus = "idle" | "assigned" | "picked_up" | "delivered";
export type UserRole = "customer" | "admin" | "delivery" | "restaurant_owner";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          phone: string | null;
          avatar_url: string | null;
          role: UserRole;
          is_active: boolean;
          referral_code: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["users"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["users"]["Row"]>;
      };
      addresses: {
        Row: {
          id: string;
          user_id: string;
          label: string;
          address_line1: string;
          address_line2: string | null;
          city: string;
          state: string;
          pincode: string;
          latitude: number | null;
          longitude: number | null;
          is_default: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["addresses"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["addresses"]["Insert"]>;
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          image_url: string | null;
          icon: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["categories"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
      };
      menu_items: {
        Row: {
          id: string;
          category_id: string;
          name: string;
          slug: string;
          description: string | null;
          price: number;
          discounted_price: number | null;
          image_url: string | null;
          is_veg: boolean;
          is_available: boolean;
          is_featured: boolean;
          is_bestseller: boolean;
          spice_level: number;
          preparation_time: number;
          calories: number | null;
          tags: string[];
          sort_order: number;
          rating: number;
          review_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["menu_items"]["Row"], "id" | "created_at" | "updated_at" | "rating" | "review_count">;
        Update: Partial<Database["public"]["Tables"]["menu_items"]["Insert"]>;
      };
      coupons: {
        Row: {
          id: string;
          code: string;
          description: string | null;
          discount_type: "percentage" | "fixed";
          discount_value: number;
          min_order_amount: number;
          max_discount: number | null;
          usage_limit: number | null;
          used_count: number;
          valid_from: string;
          valid_until: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["coupons"]["Row"], "id" | "created_at" | "used_count">;
        Update: Partial<Database["public"]["Tables"]["coupons"]["Insert"]>;
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          user_id: string;
          status: OrderStatus;
          payment_method: PaymentMethod;
          payment_status: PaymentStatus;
          subtotal: number;
          delivery_fee: number;
          discount_amount: number;
          total_amount: number;
          coupon_id: string | null;
          delivery_address: Json;
          special_instructions: string | null;
          estimated_time: number;
          created_at: string;
          updated_at: string;
          delivered_at: string | null;
          cancellation_reason: string | null;
          cancelled_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["orders"]["Row"], "id" | "order_number" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          menu_item_id: string;
          name: string;
          price: number;
          quantity: number;
          subtotal: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["order_items"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["order_items"]["Insert"]>;
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          razorpay_order_id: string | null;
          razorpay_payment_id: string | null;
          razorpay_signature: string | null;
          amount: number;
          currency: string;
          status: PaymentStatus;
          method: PaymentMethod;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["payments"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
      };
      delivery_partners: {
        Row: {
          id: string;
          name: string;
          phone: string;
          vehicle_type: string;
          vehicle_number: string | null;
          is_available: boolean;
          current_lat: number | null;
          current_lng: number | null;
          total_deliveries: number;
          rating: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["delivery_partners"]["Row"], "created_at" | "total_deliveries" | "rating">;
        Update: Partial<Database["public"]["Tables"]["delivery_partners"]["Insert"]>;
      };
      delivery_tracking: {
        Row: {
          id: string;
          order_id: string;
          partner_id: string | null;
          latitude: number | null;
          longitude: number | null;
          status: DeliveryStatus;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["delivery_tracking"]["Row"], "id" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["delivery_tracking"]["Insert"]>;
      };
      reviews: {
        Row: {
          id: string;
          user_id: string;
          menu_item_id: string;
          order_id: string | null;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["reviews"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["reviews"]["Insert"]>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string | null;
          title: string;
          message: string;
          type: string;
          is_read: boolean;
          data: Json | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["notifications"]["Row"], "id" | "created_at" | "is_read">;
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
      };
      order_reviews: {
        Row: {
          id: string;
          user_id: string;
          order_id: string;
          overall_rating: number;
          food_quality_rating: number | null;
          taste_rating: number | null;
          packaging_rating: number | null;
          delivery_rating: number | null;
          comment: string | null;
          photos: string[];
          owner_reply: string | null;
          owner_replied_at: string | null;
          is_edited: boolean;
          edited_at: string | null;
          helpful_count: number;
          not_helpful_count: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["order_reviews"]["Row"], "id" | "created_at" | "helpful_count" | "not_helpful_count" | "is_edited">;
        Update: Partial<Database["public"]["Tables"]["order_reviews"]["Insert"]>;
      };
      review_item_ratings: {
        Row: {
          id: string;
          review_id: string;
          menu_item_id: string;
          order_item_id: string | null;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["review_item_ratings"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["review_item_ratings"]["Insert"]>;
      };
      review_helpful: {
        Row: {
          id: string;
          review_id: string;
          user_id: string;
          is_helpful: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["review_helpful"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["review_helpful"]["Insert"]>;
      };
    };
  };
}

// ============================================================
// CONVENIENCE TYPES
// ============================================================
export type User          = Database["public"]["Tables"]["users"]["Row"];
export type Address       = Database["public"]["Tables"]["addresses"]["Row"];
export type Category      = Database["public"]["Tables"]["categories"]["Row"];
export type MenuItem      = Database["public"]["Tables"]["menu_items"]["Row"];
export type Coupon        = Database["public"]["Tables"]["coupons"]["Row"];
export type Order         = Database["public"]["Tables"]["orders"]["Row"];
export type OrderItem     = Database["public"]["Tables"]["order_items"]["Row"];
export type Payment       = Database["public"]["Tables"]["payments"]["Row"];
export type DeliveryPartner = Database["public"]["Tables"]["delivery_partners"]["Row"];
export type DeliveryTracking = Database["public"]["Tables"]["delivery_tracking"]["Row"];
export type Review        = Database["public"]["Tables"]["reviews"]["Row"];
export type Notification  = Database["public"]["Tables"]["notifications"]["Row"];
export type OrderReview       = Database["public"]["Tables"]["order_reviews"]["Row"];
export type ReviewItemRating  = Database["public"]["Tables"]["review_item_ratings"]["Row"];
export type ReviewHelpful     = Database["public"]["Tables"]["review_helpful"]["Row"];

export type OrderWithItems = Order & {
  order_items: (OrderItem & { menu_items: MenuItem | null })[];
  users: User | null;
  delivery_tracking: DeliveryTracking[];
};

export type CartItem = {
  id: string;
  menu_item: MenuItem;
  quantity: number;
};

export type DeliveryAddress = {
  label: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
};

// ── Referral System Types ─────────────────────────────────────
export type ReferralSettings = {
  id: number;
  is_enabled: boolean;
  max_referrals: number;
  reward_milestone_1: number; reward_amount_1: number;
  reward_milestone_3: number; reward_amount_3: number;
  reward_milestone_5: number; reward_amount_5: number;
  reward_milestone_10: number; reward_amount_10: number;
  min_order_amount: number;
  reward_expiry_days: number;
  created_at: string;
  updated_at: string;
};

export type Referral = {
  id: string;
  referrer_id: string;
  referred_id: string;
  referral_code: string;
  status: "pending" | "completed" | "rejected" | "revoked";
  first_order_id: string | null;
  first_order_status: string | null;
  completed_at: string | null;
  created_at: string;
};

export type ReferralReward = {
  id: string;
  referrer_id: string;
  referral_id: string;
  milestone: number;
  reward_amount: number;
  status: "unused" | "used" | "expired" | "revoked";
  order_id: string | null;
  expires_at: string | null;
  created_at: string;
};

