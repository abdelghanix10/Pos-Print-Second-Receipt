/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { Component } from "@odoo/owl";
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
  }
}

patch(PosStore.prototype, {
  async printReceipt() {

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
      return result;
    }

    // Add a delay to avoid conflict with the first print dialog/job
    await new Promise((resolve) => setTimeout(resolve, 1000));

    try {
      if (!receiptData) {
        return result;
      }

      // Check print method from config
      const printMethod =
        this.config.second_receipt_print_method || "chrome_dialog";

      if (printMethod === "qz_tray") {
        // Use QZ Tray for direct printing (same method as first receipt)
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

    } catch (e) {
      console.error("Second receipt print error:", e);
    } finally {
      // Clear the data after use to prevent stale data on next order
      this.secondReceiptData = null;
    }

    return result;
  },
});


// QZ Tray printing helper method - matches the approach used in odoo_qz_print/pos_qz_patch.js
PosStore.prototype.printSecondReceiptWithQZTray = async function (receiptData) {
  try {
    // Get the QZ Tray service (same one used for first receipt in odoo_qz_print)
    const qzService = this.env.services.qz_tray;

    if (!qzService) {
      console.error("QZ Tray service not available - falling back to browser print");
      // Fallback to browser print
      await this.printer.print(
        SecondReceipt,
        {
          data: receiptData,
          formatCurrency: this.env.utils.formatCurrency,
        },
        { webPrintFallback: true }
      );
      return;
    }

    // Connect to QZ Tray (this handles security/certificate configuration)
    await qzService.connect();

    // Get the QZ library
    const qzLib = qzService.getQZ();

    if (!qzLib) {
      console.error("QZ Tray library not available - falling back to browser print");
      // Fallback to browser print
      await this.printer.print(
        SecondReceipt,
        {
          data: receiptData,
          formatCurrency: this.env.utils.formatCurrency,
        },
        { webPrintFallback: true }
      );
      return;
    }

    // Get the renderer service from env (same as first receipt)
    const renderer = this.env.services.renderer;

    // Render the SecondReceipt component to HTML using Odoo's renderer
    const receiptHtml = await renderer.toHtml(
      SecondReceipt,
      {
        data: receiptData,
        formatCurrency: this.env.utils.formatCurrency,
      },
      { addClass: "pos-receipt-print" }
    );

    // Get the HTML content
    const htmlContent = receiptHtml.outerHTML;

    // Get default printer and print using the service's print method
    const printerName = await qzLib.printers.getDefault();
    await qzService.print(printerName, htmlContent, "pixel");
  } catch (error) {
    console.error("QZ Tray second receipt print error:", error);
    // Fallback to browser print on error
    try {
      await this.printer.print(
        SecondReceipt,
        {
          data: receiptData,
          formatCurrency: this.env.utils.formatCurrency,
        },
        { webPrintFallback: true }
      );
    } catch (fallbackError) {
      console.error("Fallback print also failed:", fallbackError);
    }
  }
};

patch(PaymentScreen.prototype, {
  async validateOrder() {
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
    // Call the original validateOrder
    return await super.validateOrder(...arguments);
  },
});
