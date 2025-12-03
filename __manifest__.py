{
    'name': 'POS Print Second Receipt',
    'version': '18.0.1.0.0',
    'category': 'Point of Sale',
    'summary': 'Print a second simplified receipt automatically',
    'depends': ['point_of_sale'],
    'data': [
        'views/pos_config_views.xml',
    ],
    'assets': {
        'point_of_sale._assets_pos': [
            'pos_print_second_receipt/static/src/xml/second_receipt.xml',
            'pos_print_second_receipt/static/src/js/second_receipt.js',
        ],
    },
    'installable': True,
    'application': False,
    'license': 'LGPL-3',
}
