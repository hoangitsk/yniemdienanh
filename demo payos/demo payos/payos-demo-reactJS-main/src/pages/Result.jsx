import React, { useEffect, useState } from "react";
import { Box, Typography, LinearProgress, Toolbar } from "@mui/material";
import PaymentFieldsTableDemo from "../components/PaymentFieldsTableDemo";
import OrderTableDemo from "../components/OrderTableDemo";
import { toast, ToastContainer } from "react-toastify";
import { useLocation } from "react-router-dom";
import { getOrder } from "../api/payosApi";
import Header from "../components/Header";
export default function Result() {
  const [order, setOrder] = useState();
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  let orderCode = null;
  let paramsValue = new URLSearchParams(location.search);
  if (paramsValue.size === 0) {
    orderCode = location.state?.orderCode;
  }else{
    orderCode = paramsValue.get("orderCode")
  }

  useEffect(() => {
    if (orderCode !== null) {
      getOrder(orderCode)
        .then(data => {
          console.log(data);
          if (data.error == 0) {
            setOrder(data.data);
          } else if (data.error == -1) {
            toast.warning('Không tìm thấy đơn hàng');
          }
          setLoading(false);
        })
        .catch(error => {
          toast.error('Có lỗi xảy ra');
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);
  return (
    <Box>
      <Header/>
      <ToastContainer />
      {loading ? (
        <LinearProgress />
      ) : (
        <Box>
          <OrderTableDemo data={order} />
          <PaymentFieldsTableDemo data={order?.webhook_snapshot} />
        </Box>
      )}
    </Box>
  );
}
