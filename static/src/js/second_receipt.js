/** @odoo-module */

console.log("POS Print Second Receipt: JS File Loading...");

import { ReceiptScreen } from "@point_of_sale/app/screens/receipt_screen/receipt_screen";
import { patch } from "@web/core/utils/patch";
import { Component } from "@odoo/owl";

export class SecondReceipt extends Component {
    static template = "pos_print_second_receipt.SecondReceipt";
    static props = {
        data: Object,
        formatCurrency: Function,
    };
}

patch(ReceiptScreen.prototype, {
    async printReceipt() {
        console.log("POS Print Second Receipt: printReceipt called");
        // Call the original printReceipt to print the standard receipt
        const result = await super.printReceipt();

        // If the first receipt printed successfully (or if we want to try anyway)
        // We print the second receipt
        if (result) {
            console.log("POS Print Second Receipt: First receipt success, printing second...");
            try {
                const currentOrder = this.currentOrder || this.env.services.pos.get_order();
                if (!currentOrder) {
                    console.error("POS Print Second Receipt: No current order found");
                    return result;
                }
                const data = currentOrder.export_for_printing();

                await this.printer.print(SecondReceipt, {
                    data: data,
                    formatCurrency: this.env.utils.formatCurrency,
                });
                console.log("POS Print Second Receipt: Second receipt printed");
            } catch (e) {
                console.error("POS Print Second Receipt: Failed to print second receipt:", e);
            }
        } else {
            console.log("POS Print Second Receipt: First receipt failed or cancelled");
        }

        return result;
    }
});

console.log("POS Print Second Receipt: Module loaded");
