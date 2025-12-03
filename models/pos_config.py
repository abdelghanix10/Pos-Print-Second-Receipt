from odoo import fields, models


class PosConfig(models.Model):
    _inherit = 'pos.config'

    second_receipt_enabled = fields.Boolean(
        string='Enable Second Receipt',
        default=True,
        help='Enable printing of a second simplified receipt after the main receipt.'
    )