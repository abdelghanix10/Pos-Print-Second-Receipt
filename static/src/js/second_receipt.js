/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { Component, onMounted } from "@odoo/owl";
import { PosStore } from "@point_of_sale/app/services/pos_store";
import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";

export class SecondReceipt extends Component {
  static template = "pos_print_second_receipt.SecondReceipt";
  static props = {
    data: Object,
    formatCurrency: Function,
  };
  setup() {
    super.setup();
    console.log("POS Print Second Receipt: Component setup...");
    onMounted(() => {
      console.log("POS Print Second Receipt: Component mounted!");
    });
  }
}

patch(PosStore.prototype, {
  async printReceipt() {
    console.log("POS Print Second Receipt: PosStore printReceipt called");

    // Attempt to define captureData helper if not exists (or just inline it)
    // We'll inline robust logic here to ensure we get data if PaymentScreen didn't set it.
    if (!this.secondReceiptData) {
      let order = null;
      // Handle Odoo version differences: get_order might be a function, or a getter/property
      if (typeof this.get_order === "function") {
        order = this.get_order();
      } else if (this.get_order) {
        order = this.get_order;
      } else if (this.selectedOrder) {
        order = this.selectedOrder;
      }

      if (order) {
        console.log(
          "POS Print Second Receipt: Capturing data from current order (fallback)..."
        );
        const lines = order.get_orderlines
          ? order.get_orderlines()
          : order.lines || order.orderlines || [];
        this.secondReceiptData = {
          name: order.pos_reference || order.name || "Order",
          date: (function () {
            const now = new Date();
            const pad = (n) => String(n).padStart(2, "0");
            return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
              now.getDate()
            )} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
              now.getSeconds()
            )}`;
          })(),
          orderlines: lines.map((line) => {
            return {
              id: line.id || line.cid,
              product_name:
                line.full_product_name ||
                line.product_name ||
                "Unknown Product",
              qty: line.get_quantity
                ? line.get_quantity()
                : line.quantity || line.qty || 0,
              price: line.get_unit_display_price
                ? line.get_unit_display_price()
                : line.price || line.price_unit || 0,
            };
          }),
        };
      }
    }

    // Capture locally in case strict mode or async changes clear it on 'this'
    const receiptData = this.secondReceiptData;

    // Call the original printReceipt
    const result = await super.printReceipt(...arguments);

    // Check if second receipt is enabled
    if (!this.config.second_receipt_enabled) {
      console.log("POS Print Second Receipt: Second receipt disabled");
      return result;
    }

    console.log(
      "POS Print Second Receipt: Original print finished, waiting 1s then printing second..."
    );

    // Add a delay to avoid conflict with the first print dialog/job
    await new Promise((resolve) => setTimeout(resolve, 1000));

    try {
      if (!receiptData) {
        console.error("POS Print Second Receipt: No receipt data found");
        return result;
      }

      // Check print method from config
      const printMethod =
        this.config.second_receipt_print_method || "chrome_dialog";
      console.log("POS Print Second Receipt: Using print method:", printMethod);
      console.log("POS Print Second Receipt: Using printer:", this.printer);

      if (printMethod === "qz_tray") {
        // Use QZ Tray for direct printing
        await this.printSecondReceiptWithQZTray(receiptData);
      } else {
        // Use Chrome print dialog (default)
        await this.printer.print(
          SecondReceipt,
          {
            data: receiptData,
            formatCurrency: this.env.utils.formatCurrency,
          },
          { webPrintFallback: true }
        );
      }

      console.log("POS Print Second Receipt: Second receipt printed");
    } catch (e) {
      console.error(
        "POS Print Second Receipt: Failed to print second receipt:",
        e
      );
    } finally {
      // Clear the data after use to prevent stale data on next order
      this.secondReceiptData = null;
    }

    return result;
  },
});

console.log("POS Print Second Receipt: Module loaded");

// QZ Tray printing helper method
PosStore.prototype.printSecondReceiptWithQZTray = async function (receiptData) {
  try {
    if (typeof qz === "undefined") {
      console.error("POS Print Second Receipt: QZ Tray is not loaded");
      throw new Error(
        "QZ Tray is not available. Please ensure QZ Tray is installed and running."
      );
    }

    // Connect to QZ Tray if not already connected
    if (!qz.websocket.isActive()) {
      console.log("POS Print Second Receipt: Connecting to QZ Tray...");
      await qz.websocket.connect();
    }

    // Get the default printer or configured printer
    const printer = await qz.printers.getDefault();
    console.log("POS Print Second Receipt: QZ Tray printer:", printer);

    // Build receipt content
    let receiptContent = [];
    receiptContent.push("\x1B\x40"); // Initialize printer
    receiptContent.push("\x1B\x61\x01"); // Center alignment
    receiptContent.push("SECOND RECEIPT\n");
    receiptContent.push("================================\n");
    receiptContent.push("\x1B\x61\x00"); // Left alignment
    receiptContent.push(`Order: ${receiptData.name}\n`);
    receiptContent.push(`Date: ${receiptData.date}\n`);
    receiptContent.push("--------------------------------\n");

    for (const line of receiptData.orderlines) {
      receiptContent.push(`${line.product_name}\n`);
      receiptContent.push(
        `  ${line.qty} x ${this.env.utils.formatCurrency(line.price)}\n`
      );
    }

    receiptContent.push("================================\n");
    receiptContent.push("\n\n\n"); // Feed paper
    receiptContent.push("\x1D\x56\x00"); // Cut paper

    const config = qz.configs.create(printer);
    const data = [
      { type: "raw", format: "command", data: receiptContent.join("") },
    ];

    await qz.print(config, data);
    console.log("POS Print Second Receipt: QZ Tray print successful");
  } catch (error) {
    console.error("POS Print Second Receipt: QZ Tray print failed:", error);
    throw error;
  }
};

patch(PaymentScreen.prototype, {
  async validateOrder() {
    console.log("POS Print Second Receipt: PaymentScreen validateOrder called");
    // Capture the receipt data before finalize
    const order = this.currentOrder;
    const lines = order.lines || order.orderlines || [];
    this.pos.secondReceiptData = {
      name: order.pos_reference || order.name || "Order",
      date: (function () {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
          now.getDate()
        )} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
          now.getSeconds()
        )}`;
      })(),
      orderlines: lines.map((line) => {
        return {
          id: line.id || line.cid,
          product_name:
            line.full_product_name || line.product_name || "Unknown Product",
          qty: line.get_quantity
            ? line.get_quantity()
            : line.quantity || line.qty || 0,
          price: line.get_unit_display_price
            ? line.get_unit_display_price()
            : line.price || line.price_unit || 0,
        };
      }),
    };
    console.log(
      "POS Print Second Receipt: Captured data",
      this.pos.secondReceiptData
    );
    // Call the original validateOrder
    return await super.validateOrder(...arguments);
  },
});
