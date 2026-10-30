export type FoodType = 'veg' | 'nonveg' | 'egg';
export type Station = 'Kitchen' | 'Bar';

export interface MenuCategory {
  id: string;
  name: string;
  icon: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  price: number;
}

export interface Modifier {
  id: string;
  name: string;
  price: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  min: number;
  max: number;
  modifiers: Modifier[];
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  emoji: string;
  foodType: FoodType;
  station: Station;
  prepMinutes: number;
  variants: ProductVariant[];
  modifierGroupIds: string[];
  popular?: boolean;
}

export type TableStatus = 'Available' | 'Occupied' | 'Reserved' | 'Cleaning';

export interface DiningTable {
  id: string;
  code: string;
  area: string;
  capacity: number;
  status: TableStatus;
}

export type SessionStatus = 'Open' | 'BillRequested' | 'Settling' | 'Closed';

export interface TableSession {
  id: string;
  tableId: string;
  status: SessionStatus;
  guestCount: number;
  guestJoins: number;
  openedAt: number;
  closedAt?: number;
  billRequestedAt?: number;
  waiterCalledAt?: number;
  waiterReason?: string;
}

export type OrderStatus = 'Submitted' | 'Preparing' | 'Ready' | 'Served' | 'Cancelled';
export type OrderSource = 'QR' | 'POS';

export interface OrderItemModifier {
  modifierId: string;
  name: string;
  price: number;
}

/** Server-priced snapshot: later menu changes never rewrite these values. */
export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  variantName: string;
  emoji: string;
  foodType: FoodType;
  station: Station;
  quantity: number;
  unitPrice: number;
  modifiers: OrderItemModifier[];
  lineTotal: number;
  notes?: string;
}

export interface Order {
  id: string;
  number: number;
  tableId: string | null;
  sessionId: string | null;
  source: OrderSource;
  guestLabel?: string;
  status: OrderStatus;
  items: OrderItem[];
  subTotal: number;
  createdAt: number;
  servedAt?: number;
  idempotencyKey?: string;
}

export type TicketStatus = 'Queued' | 'InProgress' | 'Ready';

export interface KitchenTicket {
  id: string;
  orderId: string;
  orderNumber: number;
  tableCode: string;
  source: OrderSource;
  station: Station;
  status: TicketStatus;
  itemIds: string[];
  createdAt: number;
  startedAt?: number;
  readyAt?: number;
}

export type PaymentMethod = 'Cash' | 'UPI' | 'Card';
/** Methods a guest can pay with from their phone (via the payment gateway). */
export type OnlinePaymentMethod = 'UPI' | 'Card';

export interface Payment {
  id: string;
  method: PaymentMethod;
  amount: number;
  at: number;
}

export interface InvoiceLine {
  description: string;
  quantity: number;
  amount: number;
}

export interface BillSummary {
  lines: InvoiceLine[];
  subTotal: number;
  discountPct: number;
  discount: number;
  taxable: number;
  cgst: number;
  sgst: number;
  roundOff: number;
  total: number;
}

export interface Invoice extends BillSummary {
  /** `Order`: a guest order paid when placed. `Session`: the table bill for anything not prepaid (e.g. POS orders). */
  kind: 'Order' | 'Session';
  orderIds: string[];
  id: string;
  invoiceNo: string;
  sessionId: string;
  tableCode: string;
  status: 'Issued' | 'Paid';
  payments: Payment[];
  issuedAt: number;
  paidAt?: number;
  approvedBy?: string;
}

/** Client-side cart selection. Carries ids only; prices are recomputed by the server. */
export interface CartLine {
  key: string;
  productId: string;
  variantId: string;
  modifierIds: string[];
  quantity: number;
  notes?: string;
}

export interface CafeProfile {
  name: string;
  tagline: string;
  branch: string;
  gstin: string;
  fssai: string;
  invoicePrefix: string;
}

/** Menu as served to a branch: categories, products and the modifier groups they reference. */
export interface Catalog {
  categories: MenuCategory[];
  products: Product[];
  modifierGroups: Record<string, ModifierGroup>;
}
