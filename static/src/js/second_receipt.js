/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { Component } from "@odoo/owl";
import { PosStore } from "@point_of_sale/app/services/pos_store";

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

/**
 * Helper function to extract receipt data from an order object.
 * This is called at print time to ensure we have the correct order's data.
 */
function extractReceiptData(order) {
  if (!order) {
    return null;
  }

  // Get order lines - handle different Odoo versions
  let lines = [];
  if (order.get_orderlines && typeof order.get_orderlines === "function") {
    lines = order.get_orderlines();
  } else if (order.lines) {
    lines = order.lines;
  } else if (order.orderlines) {
    lines = order.orderlines;
  }

  // Get the order date - use the order's date if available, otherwise use validation time
  let orderDate;
  if (order.date_order) {
    // If it's a luxon DateTime object
    if (order.date_order.toFormat) {
      orderDate = order.date_order.toFormat("yyyy-MM-dd HH:mm:ss");
    } else if (order.date_order instanceof Date) {
      const d = order.date_order;
      const pad = (n) => String(n).padStart(2, "0");
      orderDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } else {
      // It's already a string
      orderDate = order.date_order;
    }
  } else if (order.creation_date) {
    if (order.creation_date.toFormat) {
      orderDate = order.creation_date.toFormat("yyyy-MM-dd HH:mm:ss");
    } else {
      orderDate = String(order.creation_date);
    }
  } else {
    // Fallback to current time
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    orderDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }

  return {
    name: order.pos_reference || order.name || "Order",
    date: orderDate,
    orderlines: lines.map((line) => {
      // Get product name
      let productName = "Unknown Product";
      if (line.full_product_name) {
        productName = line.full_product_name;
      } else if (line.product_id && line.product_id.display_name) {
        productName = line.product_id.display_name;
      } else if (line.product_name) {
        productName = line.product_name;
      }

      // Get quantity
      let qty = 0;
      if (line.get_quantity && typeof line.get_quantity === "function") {
        qty = line.get_quantity();
      } else if (line.quantity !== undefined) {
        qty = line.quantity;
      } else if (line.qty !== undefined) {
        qty = line.qty;
      }

      // Get price
      let price = 0;
      if (line.get_unit_display_price && typeof line.get_unit_display_price === "function") {
        price = line.get_unit_display_price();
      } else if (line.price !== undefined) {
        price = line.price;
      } else if (line.price_unit !== undefined) {
        price = line.price_unit;
      }

      return {
        id: line.id || line.cid || line.uuid,
        product_name: productName,
        qty: qty,
        price: price,
      };
    }),
  };
}

/**
 * Patch PosStore.printReceipt to print a second receipt.
 * 
 * The key insight is that printReceipt receives the order as a parameter:
 *   printReceipt({ order = this.getOrder(), ... })
 * 
 * By extracting data directly from this order parameter at print time,
 * we avoid all race conditions with feedback bypass - each print call
 * has its own order reference that won't be affected by other orders.
 */
patch(PosStore.prototype, {
  async printReceipt(options = {}) {
    // Get the order from options - this is the key to avoiding race conditions!
    // Each printReceipt call receives its own order reference
    const order = options.order || this.getOrder();

    // Extract receipt data directly from the order at print time
    const receiptData = extractReceiptData(order);

    // Call the original printReceipt
    const result = await super.printReceipt(...arguments);

    // Check if second receipt is enabled
    if (!this.config.second_receipt_enabled) {
      return result;
    }

    // Don't print second receipt if no data available
    if (!receiptData || !receiptData.orderlines || receiptData.orderlines.length === 0) {
      console.warn("Second receipt: No order data available");
      return result;
    }

    // Add a delay to avoid conflict with the first print dialog/job
    await new Promise((resolve) => setTimeout(resolve, 1000));

    try {
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
