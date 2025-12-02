/** @odoo-module */

console.log("POS Print Second Receipt: JS File Loading...");

import { ReceiptScreen } from "@point_of_sale/app/screens/receipt_screen/receipt_screen";
import { patch } from "@web/core/utils/patch";
import { Component } from "@odoo/owl";
import { PosStore } from "@point_of_sale/app/store/pos_store";

export class SecondReceipt extends Component {
    static template = "pos_print_second_receipt.SecondReceipt";
    static props = {
        data: Object,
        formatCurrency: Function,
    };
}

patch(PosStore.prototype, {
    async printReceipt() {
        console.log("POS Print Second Receipt: PosStore printReceipt called");
        // Call the original printReceipt
        const result = await super.printReceipt(...arguments);

        // We print the second receipt
        // We don't strictly check result because printReceipt might return void or undefined
        // But usually if it fails it throws or returns false.

        console.log("POS Print Second Receipt: Original print finished, printing second...");
        try {
            const currentOrder = this.get_order();
            if (!currentOrder) {
                console.error("POS Print Second Receipt: No current order found");
                return result;
            }
            const data = currentOrder.export_for_printing();

            // Use this.printer which is available in PosStore
            await this.printer.print(SecondReceipt, {
                data: data,
                formatCurrency: this.env.utils.formatCurrency,
            });
            console.log("POS Print Second Receipt: Second receipt printed");
        } catch (e) {
            console.error("POS Print Second Receipt: Failed to print second receipt:", e);
        }

        return result;
    }
});

console.log("POS Print Second Receipt: Module loaded");
