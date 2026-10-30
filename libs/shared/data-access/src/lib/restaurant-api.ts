import { Signal } from '@angular/core';
import {
  CafeProfile, CartLine, Catalog, DiningTable, Invoice, KitchenTicket, MenuCategory, Product, OnlinePaymentMethod, Order, OrderSource, PaymentMethod,
  TableSession, TicketStatus,
} from '@ros/shared/domain';

export interface SubmitOrderRequest {
  idempotencyKey: string;
  tableId: string;
  source: OrderSource;
  guestLabel?: string;
  lines: CartLine[];
}

export interface PaidOrderResult {
  order: Order;
  invoice: Invoice;
}

export interface JoinTableResult {
  session: TableSession;
  guestLabel: string;
}

/**
 * Contract between the apps and the backend. Reads are signals kept current by real-time
 * pushes; writes are async commands. Today `DummyRestaurantApi` implements it; the .NET
 * HTTP + SignalR implementation will replace it without changes to any screen.
 */
export abstract class RestaurantApi {
  abstract readonly cafe: Signal<CafeProfile>;
  abstract readonly catalog: Signal<Catalog>;
  abstract readonly tables: Signal<DiningTable[]>;
  abstract readonly sessions: Signal<TableSession[]>;
  abstract readonly orders: Signal<Order[]>;
  abstract readonly tickets: Signal<KitchenTicket[]>;
  abstract readonly invoices: Signal<Invoice[]>;
  abstract readonly soldOut: Signal<string[]>;

  /** Seats a signed-in diner at the table, opening a session if needed.  is shown to staff. */
  abstract joinTable(tableId: string, guestName?: string): Promise<JoinTableResult>;
  abstract openTable(tableId: string, guestCount: number): Promise<TableSession>;
  /** Staff orders (POS): billed later on the table bill. */
  abstract submitOrder(request: SubmitOrderRequest): Promise<Order>;
  /**
   * Guest orders: paid when placed. The order reaches the kitchen only together with its paid invoice;
   * a failed payment creates nothing. Production confirms the gateway payment server-side first.
   */
  abstract placePaidOrder(request: SubmitOrderRequest, method: OnlinePaymentMethod): Promise<PaidOrderResult>;
  abstract setTicketStatus(ticketId: string, status: TicketStatus): Promise<void>;
  abstract markServed(orderId: string): Promise<void>;
  abstract callWaiter(sessionId: string, reason?: string): Promise<void>;
  abstract acknowledgeWaiter(sessionId: string): Promise<void>;
  abstract requestBill(sessionId: string): Promise<void>;
  abstract checkout(sessionId: string, discountPct: number, approvedBy?: string): Promise<Invoice>;
  abstract recordPayment(invoiceId: string, method: PaymentMethod, amount: number): Promise<Invoice>;
  /** Ends a visit whose orders are all paid; the table moves to cleaning. */
  abstract closeTable(sessionId: string): Promise<void>;
  abstract markTableClean(tableId: string): Promise<void>;
  abstract toggleSoldOut(productId: string): Promise<void>;
  /** Menu management (admin). Saving with an unknown id creates; past orders keep their snapshots. */
  abstract saveCategory(category: MenuCategory): Promise<MenuCategory>;
  /** Only empty categories can be deleted. */
  abstract deleteCategory(categoryId: string): Promise<void>;
  abstract saveProduct(product: Product): Promise<Product>;
  abstract deleteProduct(productId: string): Promise<void>;
  /** Dummy backend only: re-seed sample data. */
  abstract resetData(): void;
}
