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
      const data = this.secondReceiptData;
      if (!data) {
        console.error("POS Print Second Receipt: No receipt data found");
        return result;
      }

      // Use this.printer which is available in PosStore
      console.log("POS Print Second Receipt: Using printer:", this.printer);
      await this.printer.print(
        SecondReceipt,
        {
          data: data,
          formatCurrency: this.env.utils.formatCurrency,
        },
        { webPrintFallback: true }
      );

      console.log("POS Print Second Receipt: Second receipt printed");
    } catch (e) {
      console.error(
        "POS Print Second Receipt: Failed to print second receipt:",
        e
      );
    }

    return result;
  },
});

console.log("POS Print Second Receipt: Module loaded");

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
        const product = line.get_product ? line.get_product() : line.product;
        return {
          id: line.id || line.cid,
          product_name: product
            ? product.display_name
            : line.product_name || "Unknown Product",
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
