# ERP System Demo Users Guide

## Overview
The OLUTAJR ERP System includes pre-configured demo user accounts with different roles and access levels. Use these credentials to test the role-based access control system.

---

## Demo User Accounts

### 1. Super Admin (Full Access)
- **Email:** `admin@olutajr.com`
- **Password:** `admin`
- **Role:** Super Admin
- **Access:** All 11 modules
- **Modules Available:**
  - ✅ Dashboard
  - ✅ Point of Sale (POS)
  - ✅ Sales History
  - ✅ Customers
  - ✅ Products
  - ✅ Stock Management
  - ✅ Finance
  - ✅ Reporting
  - ✅ Expenses
  - ✅ User Management
  - ✅ Settings

---

### 2. Admin (Full Access)
- **Email:** `admin@demo.com`
- **Password:** `demo123`
- **Role:** Admin
- **Access:** All 11 modules (same as Super Admin)
- **Modules Available:**
  - ✅ Dashboard
  - ✅ Point of Sale (POS)
  - ✅ Sales History
  - ✅ Customers
  - ✅ Products
  - ✅ Stock Management
  - ✅ Finance
  - ✅ Reporting
  - ✅ Expenses
  - ✅ User Management
  - ✅ Settings

---

### 3. Manager (Limited Access)
- **Email:** `manager@demo.com`
- **Password:** `manager123`
- **Role:** Manager
- **Access:** 9 out of 11 modules
- **Modules Available:**
  - ✅ Dashboard
  - ✅ Point of Sale (POS)
  - ✅ Sales History
  - ✅ Customers
  - ✅ Products
  - ✅ Stock Management
  - ✅ Finance
  - ✅ Reporting
  - ✅ Expenses
  - ❌ User Management (restricted)
  - ❌ Settings (restricted)
- **Use Case:** Operations managers who need access to most features but shouldn't manage users or system settings

---

### 4. Cashier (Highly Restricted)
- **Email:** `cashier@demo.com`
- **Password:** `cashier123`
- **Role:** Cashier
- **Access:** 4 out of 11 modules
- **Modules Available:**
  - ✅ Dashboard
  - ✅ Point of Sale (POS)
  - ✅ Sales History
  - ✅ Customers
  - ❌ Products (restricted)
  - ❌ Stock Management (restricted)
  - ❌ Finance (restricted)
  - ❌ Reporting (restricted)
  - ❌ Expenses (restricted)
  - ❌ User Management (restricted)
  - ❌ Settings (restricted)
- **Use Case:** Front-line cashiers who only need to process sales and view customer info

---

### 5. Viewer (Minimal Access - Read-Only)
- **Email:** `viewer@demo.com`
- **Password:** `viewer123`
- **Role:** Viewer
- **Access:** 3 out of 11 modules (read-only)
- **Modules Available:**
  - ✅ Dashboard (view only)
  - ❌ Point of Sale (restricted)
  - ✅ Sales History (view only)
  - ❌ Customers (restricted)
  - ❌ Products (restricted)
  - ❌ Stock Management (restricted)
  - ✅ Reporting (view only)
  - ❌ Finance (restricted)
  - ❌ Expenses (restricted)
  - ❌ User Management (restricted)
  - ❌ Settings (restricted)
- **Use Case:** Reports and analysis viewers who need visibility but cannot make changes

---

## Access Control Matrix

| Module | Super Admin | Admin | Manager | Cashier | Viewer |
|--------|-------------|-------|---------|---------|--------|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| Point of Sale | ✅ | ✅ | ✅ | ✅ | ❌ |
| Sales History | ✅ | ✅ | ✅ | ✅ | ✅ |
| Customers | ✅ | ✅ | ✅ | ✅ | ❌ |
| Products | ✅ | ✅ | ✅ | ❌ | ❌ |
| Stock Management | ✅ | ✅ | ✅ | ❌ | ❌ |
| Finance | ✅ | ✅ | ✅ | ❌ | ❌ |
| Reporting | ✅ | ✅ | ✅ | ❌ | ✅ |
| Expenses | ✅ | ✅ | ✅ | ❌ | ❌ |
| User Management | ✅ | ✅ | ❌ | ❌ | ❌ |
| Settings | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## How to Test

1. **Open the Application**
   - Navigate to: `http://127.0.0.1:5000`
   - The Flask server must be running

2. **Login with Demo Account**
   - Enter email and password from the accounts above
   - Click "Sign In"

3. **Observe Access Control**
   - Notice how the sidebar navigation changes based on role
   - Some modules will be hidden for restricted roles
   - Try accessing restricted pages directly to see the "Access denied" message

4. **Create Additional Users**
   - Login as Admin or Super Admin
   - Go to "User Management" section
   - Add new users with specific role assignments
   - All new users inherit the module permissions of their assigned role

---

## Key Features Demonstrated

✨ **Role-Based Access Control (RBAC)**
- Each role has predefined permissions
- Sidebar automatically filters modules based on user permissions
- Attempts to access restricted pages are blocked with error messages

✨ **User Management Interface**
- Super Admin and Admin can create/edit/delete users
- Assign roles to users
- Enable/disable user accounts
- View user activity logs

✨ **Dynamic Permission Assignment**
- Permissions are inherited from the assigned role
- Can be customized per user if needed

✨ **Multi-Branch Support**
- Select business location during login
- Different branches can have different user bases

---

## Notes

- All demo passwords are intentionally simple for testing purposes
- In production, use strong passwords and enable password hashing
- Demo users are created automatically on first application load
- To reset to default state, clear browser localStorage and reload

---

## Creating Custom Users

Once logged in as Admin or Super Admin:

1. Navigate to **User Management** (System section)
2. Click **"Add User"** button
3. Fill in user details:
   - Name (First & Last)
   - Email address
   - Password
   - Assign Role
4. Click "Save User"
5. New user inherits all permissions of their assigned role
6. User can log in with assigned credentials

---

**Last Updated:** June 3, 2026  
**Application:** OLUTAJR ERP System v1.0.0
