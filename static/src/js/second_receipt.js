/** @odoo-module */

console.log("POS Print Second Receipt: JS File Loading...");

import { ReceiptScreen } from "@point_of_sale/app/screens/receipt_screen/receipt_screen";
import { patch } from "@web/core/utils/patch";
import { Component, onMounted } from "@odoo/owl";
import { PosStore } from "@point_of_sale/app/store/pos_store";
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

    // We print the second receipt
    // We don't strictly check result because printReceipt might return void or undefined
    // But usually if it fails it throws or returns false.

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

      // Force webPrintFallback to ensure it tries window.print if no device is set
      // or if we want to force it.
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
    const order = this.pos.get_order();
    this.pos.secondReceiptData = {
      name: order.name,
      date: order.date_order
        ? order.date_order.toFormat
          ? order.date_order.toFormat("yyyy-MM-dd")
          : order.date_order.toLocaleDateString
          ? order.date_order.toLocaleDateString()
          : order.date_order
        : "",
      orderlines: (order.orderlines || []).map((line) => ({
        id: line.id,
        product_name: line.product_name,
        qty: line.qty,
        price: line.price,
      })),
    };
    console.log(
      "POS Print Second Receipt: Captured data",
      this.pos.secondReceiptData
    );
    // Call the original validateOrder
    return await super.validateOrder(...arguments);
  },
});
