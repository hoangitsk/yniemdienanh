### This is a guide for PayOS payment gateway

To run this version, please follow these steps:
### Step 1: Install the library
```
     npm install
```

### Step 2: Add environment variables in the .env file
```
     REACT_APP_ORDER_URL = {Your URL server} //Fill in here

     REACT_APP_LISTS_BANK_URL = https://api.vietqr.io/v2/banks

     REACT_APP_PAYOS_SCRIPT = https://cdn.payos.vn/payos-checkout/v1/stable/payos-initialize.js

```

### Step 3: Run the project

```
     npm start
```