{
    'name': 'POS Print Second Receipt',
    'version': '18.0.1.0.0',
    'category': 'Point of Sale',
    'summary': 'Print a second simplified receipt automatically',
    'depends': ['point_of_sale'],
    'data': [],
    'assets': {
        'point_of_sale.assets': [
            'pos_print_second_receipt/static/src/**/*',
        ],
    },
    'installable': True,
    'application': False,
    'license': 'LGPL-3',
}
