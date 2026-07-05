import React, { useEffect, useState } from "react";
import {
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Table,
  Paper,
  Toolbar,
  Typography,
  Box,
} from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

const WEBHOOK_FIELD_DESC = {
  orderCode: "Mã đơn hàng",
  amount: "Số tiền",
  description: "Mô tả lệnh chuyển khoản",
  accountNumber: "Số tài khoản nhận",
  reference: "Mã tham chiếu",
  transactionDateTime: "Thời gian",
  paymentLinkId: "Mã link thanh toán",
  code: "Mã trạng thái thanh toán",
  desc: "Mô tả trạng thái",
  counterAccountBankId: "Mã ngân hàng đối ứng",
  counterAccountBankName: "Tên ngân hàng đối ứng",
  counterAccountName: "Tên chủ tài khoản đối ứng",
  counterAccountNumber: "Số tài khoản đối ứng",
  virtualAccountName: "Tên chủ tài khoản ảo",
  virtualAccountNumber: "Số tài khoản ảo",
};

function TableHeader() {
  return (
    <Toolbar className="!flex-1 !justify-center">
      <Typography className="!font-semibold" component="h5" variant="h5">
        Danh sách các trường dữ liệu trong webhook
      </Typography>
    </Toolbar>
  );
}

export default function PaymentFieldsTableDemo({ data }) {
  let webhookData = null;
  if (data) {
    const { orderCode, description, ...restData } = data.data;
    webhookData = { orderCode, description, ...restData };
    // xoa cac field khong co gia tri
    webhookData = Object.fromEntries(
      Object.entries(webhookData).filter(([_, v]) => v != "")
    );
  }
  return (
		<Box component={"div"} className="mx-5">
      <CssBaseline />
			<Box sx={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
				<Paper sx={{ overflow: "hidden" }}>
					<TableHeader />
					<TableContainer >
						<Table aria-label="simple table" size="small" className="md:min-w-[700px]">
							<TableHead>
								<TableRow>
									<TableCell align="center" className="!font-bold">
										Tên
									</TableCell>
									<TableCell align="center" className="!font-bold">
										Giá trị
									</TableCell>
									<TableCell align="center" className="!font-bold">
										Mô tả
									</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{data ? (
									Object.keys(webhookData).map((key) => (
										<TableRow key={key}>
											<TableCell component="th" scope="row">
												{key}
											</TableCell>
											<TableCell align="left">{data.data[key]}</TableCell>
											<TableCell align="left">
												{WEBHOOK_FIELD_DESC[key]}
											</TableCell>
										</TableRow>
									))
								) : (
									<TableRow
										key={0}
										sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
									>
										<TableCell align="center" colSpan={12}>
											Không có thông tin giao dịch
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</TableContainer>
				</Paper>
			</Box>
		</Box>
  );
}
