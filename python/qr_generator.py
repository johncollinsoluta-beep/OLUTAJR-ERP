"""
QR Code Generator Module for OLUTAJR ERP
Generates QR codes for products, transactions, receipts, etc.
"""

import io
import base64
import qrcode
from typing import Dict, List, Optional


def generate_qr_code(data: str, size: int = 10, border: int = 4) -> str:
    """
    Generate a single QR code and return as base64 data URI
    
    Args:
        data: Data to encode in QR code
        size: Size of each box in pixels
        border: Border width in boxes
        
    Returns:
        Base64 encoded data URI string
    """
    try:
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=size,
            border=border,
        )
        qr.add_data(data)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        img_io = io.BytesIO()
        img.save(img_io, 'PNG')
        img_io.seek(0)
        
        img_base64 = base64.b64encode(img_io.getvalue()).decode()
        return f"data:image/png;base64,{img_base64}"
    except Exception as e:
        raise ValueError(f"Failed to generate QR code: {str(e)}")


def generate_product_qr(product_id: str, product_name: str) -> str:
    """Generate QR code for a product"""
    data = f"PRODUCT|{product_id}|{product_name}"
    return generate_qr_code(data)


def generate_receipt_qr(receipt_id: str, amount: float, date: str) -> str:
    """Generate QR code for a receipt"""
    data = f"RECEIPT|{receipt_id}|{amount}|{date}"
    return generate_qr_code(data)


def generate_customer_qr(customer_id: str, customer_name: str) -> str:
    """Generate QR code for a customer"""
    data = f"CUSTOMER|{customer_id}|{customer_name}"
    return generate_qr_code(data)


def generate_transaction_qr(transaction_id: str, details: str) -> str:
    """Generate QR code for a transaction"""
    data = f"TRANSACTION|{transaction_id}|{details}"
    return generate_qr_code(data)


def generate_batch_qr_codes(items: List[Dict]) -> List[Dict]:
    """
    Generate QR codes for multiple items
    
    Args:
        items: List of dicts with 'id' and 'data' keys
        
    Returns:
        List of dicts with 'id' and 'qr_code' keys
    """
    qr_codes = []
    for item in items:
        try:
            qr_code = generate_qr_code(item.get("data", ""))
            qr_codes.append({
                "id": item.get("id"),
                "qr_code": qr_code,
                "data": item.get("data")
            })
        except Exception as e:
            qr_codes.append({
                "id": item.get("id"),
                "error": str(e)
            })
    
    return qr_codes
