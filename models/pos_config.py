from odoo import fields, models


class PosConfig(models.Model):
    _inherit = 'pos.config'

    second_receipt_enabled = fields.Boolean(
        string='Enable Second Receipt',
        default=True,
        help='Enable printing of a second simplified receipt after the main receipt.'
    )
    second_receipt_print_method = fields.Selection(
        selection=[
            ('chrome_dialog', 'Chrome Print Dialog'),
            ('qz_tray', 'QZ Tray'),
        ],
        string='Print Method',
        default='chrome_dialog',
        help='Select the printing method for the second receipt: Chrome Print Dialog (browser preview) or QZ Tray (direct print).'
    )