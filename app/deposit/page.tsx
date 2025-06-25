"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Smartphone, CreditCard, Banknote, CheckCircle2, XCircle, Clock, RotateCw, Loader2 } from "lucide-react"
import Link from "next/link"

type PaymentStatus =
  | "idle"
  | "pending"
  | "success"
  | "failed"
  | "timeout"
  | "wrong-pin"
  | "cancelled"
  | "insufficient-funds"
  | "user-not-found"
  | "service-unavailable"

type CardDetails = {
  number: string
  expiry: string
  cvv: string
  name: string
}

type STKResponseData = {
  ResultCode?: string
  ResultDesc?: string
  MerchantRequestID?: string
  CheckoutRequestID?: string
  MpesaReceiptNumber?: string
  TransactionDate?: string
  PhoneNumber?: string
  Amount?: number
  CallbackMetadata?: {
    Item: Array<{
      Name: string
      Value: string | number
    }>
  }
}

export default function DepositPageEarlySave() {
  const [amount, setAmount] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [depositMethod, setDepositMethod] = useState("mpesa")
  const [kshAmount, setKshAmount] = useState(0)
  const [checkoutRequestID, setCheckoutRequestID] = useState("")
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("idle")
  const [pollingCount, setPollingCount] = useState(0)
  const [depositId, setDepositId] = useState<string>("")
  const [transactionDetails, setTransactionDetails] = useState<STKResponseData | null>(null)
  const [cardDetails, setCardDetails] = useState<CardDetails>({
    number: "",
    expiry: "",
    cvv: "",
    name: "",
  })
  const router = useRouter()

  // Convert USD to KSH in real-time
  useEffect(() => {
    const amountNum = Number.parseFloat(amount) || 0
    setKshAmount(Math.round(amountNum * 130))
  }, [amount])

  // Check auth status
  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/login")
    } else {
      fetch("https://av-backend-qp7e.onrender.com/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (!res.ok) {
            localStorage.removeItem("token")
            router.push("/login")
          }
        })
        .catch(() => {
          localStorage.removeItem("token")
          router.push("/login")
        })
    }
  }, [router])

  // Poll payment status if pending
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (paymentStatus === "pending" && checkoutRequestID) {
      interval = setInterval(() => {
        checkPaymentStatus()
        setPollingCount((prev) => prev + 1)
      }, 5000) // Check every 5 seconds

      // Stop polling after 12 attempts (60 seconds)
      if (pollingCount >= 12) {
        clearInterval(interval)
        setPaymentStatus("timeout")
        updateDepositStatus("timeout", null, "Payment verification timeout")
      }
    }

    return () => clearInterval(interval)
  }, [paymentStatus, checkoutRequestID, pollingCount])

  // Handle STK response codes
  const handleSTKResponse = (resultCode: string, data: STKResponseData) => {
    const code = resultCode.toString()
    
    switch (code) {
      case "0":
        setPaymentStatus("success")
        updateDepositStatus("completed", data)
        break
      case "1":
        setPaymentStatus("pending")
        break
      case "2":
        setPaymentStatus("timeout")
        updateDepositStatus("timeout", data, "Payment timeout")
        break
      case "1032":
        setPaymentStatus("cancelled")
        updateDepositStatus("cancelled", data, "Payment cancelled by user")
        break
      case "1031":
        setPaymentStatus("user-not-found")
        updateDepositStatus("failed", data, "User not found/not an M-Pesa user")
        break
      case "1033":
        setPaymentStatus("insufficient-funds")
        updateDepositStatus("failed", data, "Insufficient funds")
        break
      case "17":
        setPaymentStatus("cancelled")
        updateDepositStatus("cancelled", data, "Payment declined by user")
        break
      case "20":
        setPaymentStatus("service-unavailable")
        updateDepositStatus("failed", data, "Service not available")
        break
      case "2001":
        setPaymentStatus("wrong-pin")
        updateDepositStatus("failed", data, "Wrong PIN entered")
        break
      default:
        setPaymentStatus("failed")
        updateDepositStatus("failed", data, `Payment failed with code: ${code}`)
    }
  }

  const checkPaymentStatus = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch("https://av-backend-qp7e.onrender.com/api/stk/stkquery", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ checkoutRequestID }),
      })

      const data = await response.json()
      console.log("STK Query Response:", data)

      if (!response.ok) {
        console.error("STK Query API Error:", data)
        if (pollingCount >= 10) {
          throw new Error(data.message || "Failed to check payment status")
        }
        return
      }

      if (data.data?.ResultCode) {
        handleSTKResponse(data.data.ResultCode, data.data)
        setTransactionDetails(data.data)
      }
    } catch (error) {
      console.error("Error checking payment status:", error)
      if (pollingCount >= 10) {
        setPaymentStatus("failed")
        updateDepositStatus("failed", null, "Error checking payment status")
      }
    }
  }

  // Save transaction immediately after STK push is initiated
  const saveInitialDeposit = async (checkoutRequestId: string) => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch("https://av-backend-qp7e.onrender.com/api/deposits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          email,
          phone: phoneNumber.replace(/\D/g, ""),
          amount: Number.parseFloat(amount),
          currency: "USD",
          status: "pending", 
          method: "mpesa",
          checkoutRequestId,
        }),
      })

      const result = await response.json()

      if (!response.ok) throw new Error("Failed to save deposit record")

      setDepositId(result.id || result._id)
      return result
    } catch (error) {
      console.error("Error saving initial deposit:", error)
      throw error
    }
  }

  // Update deposit status in DB
  const updateDepositStatus = async (
    status: string,
    transactionData: STKResponseData | null = null,
    failureReason?: string
  ) => {
    if (!depositId) return

    try {
      const token = localStorage.getItem("token")
      await fetch(`https://av-backend-qp7e.onrender.com/api/deposits/${depositId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status,
          transactionId: transactionData?.MpesaReceiptNumber || checkoutRequestID,
          mpesaData: transactionData,
          failureReason,
          completedAt: status === "completed" ? new Date().toISOString() : null,
        }),
      })
    } catch (error) {
      console.error("Error updating deposit status:", error)
    }
  }

  const handleMpesaDeposit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate inputs
    const amountNum = Number.parseFloat(amount)
    if (isNaN(amountNum) || amountNum < 100) {
      alert("Minimum deposit is $100")
      return
    }

    if (!name.trim() || !email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert("Please enter valid name and email")
      return
    }

    // Format phone number
    const cleanedPhone = phoneNumber.replace(/\D/g, "")
    let formattedPhone = cleanedPhone

    if (cleanedPhone.startsWith("0") && cleanedPhone.length === 10) {
      formattedPhone = "254" + cleanedPhone.substring(1)
    } else if (cleanedPhone.startsWith("7") && cleanedPhone.length === 9) {
      formattedPhone = "254" + cleanedPhone
    } else if (!cleanedPhone.startsWith("254") || cleanedPhone.length !== 12) {
      alert("Please enter a valid M-Pesa number (format: 254XXXXXXXXX)")
      return
    }

    setIsLoading(true)
    setPollingCount(0)
    const token = localStorage.getItem("token")

    try {
      // Initiate STK Push
      const response = await fetch("https://av-backend-qp7e.onrender.com/api/stk/stk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phoneNumber: formattedPhone,
          amount: kshAmount,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || "Deposit failed")

      if (data.checkoutRequestID) {
        setCheckoutRequestID(data.checkoutRequestID)
        await saveInitialDeposit(data.checkoutRequestID)
        setPaymentStatus("pending")
      } else {
        throw new Error("No checkout request ID received")
      }
    } catch (error: any) {
      setPaymentStatus("failed")
      alert(error.message || "An error occurred. Please try again.")
      console.error("Deposit error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const resetPayment = () => {
    setPaymentStatus("idle")
    setCheckoutRequestID("")
    setPollingCount(0)
    setDepositId("")
    setTransactionDetails(null)
  }

  const handleCardDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setCardDetails((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const quickAmounts = [100, 250, 500, 1000, 2500]

  // Status display component with detailed responses
  const PaymentStatusDisplay = () => {
    const getStatusMessage = () => {
      switch (paymentStatus) {
        case "success":
          return {
            title: "Payment Successful!",
            message: `Your deposit of $${amount} has been completed. M-Pesa receipt: ${transactionDetails?.MpesaReceiptNumber || "N/A"}`,
            icon: <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" />,
            color: "green",
            action: () => router.push("/")
          }
        case "pending":
          return {
            title: "Payment Pending",
            message: "Please complete the payment on your phone. We'll verify it shortly...",
            icon: <Loader2 className="w-12 h-12 mx-auto text-blue-500 animate-spin" />,
            color: "blue",
            action: () => router.push("/")
          }
        case "failed":
          return {
            title: "Payment Failed",
            message: "The payment could not be processed. Please try again.",
            icon: <XCircle className="w-12 h-12 mx-auto text-red-500" />,
            color: "red",
            action: resetPayment
          }
        case "timeout":
          return {
            title: "Payment Timeout",
            message: "You didn't complete the payment in time. Please try again.",
            icon: <Clock className="w-12 h-12 mx-auto text-yellow-500" />,
            color: "yellow",
            action: resetPayment
          }
        case "wrong-pin":
          return {
            title: "Wrong PIN",
            message: "You entered an incorrect PIN. Please try again with the correct PIN.",
            icon: <XCircle className="w-12 h-12 mx-auto text-red-500" />,
            color: "red",
            action: resetPayment
          }
        case "cancelled":
          return {
            title: "Payment Cancelled",
            message: "You cancelled the payment request. No amount was deducted.",
            icon: <XCircle className="w-12 h-12 mx-auto text-red-500" />,
            color: "red",
            action: resetPayment
          }
        case "insufficient-funds":
          return {
            title: "Insufficient Funds",
            message: "Your M-Pesa account has insufficient funds to complete this payment.",
            icon: <XCircle className="w-12 h-12 mx-auto text-red-500" />,
            color: "red",
            action: resetPayment
          }
        case "user-not-found":
          return {
            title: "User Not Found",
            message: "The phone number is not registered with M-Pesa. Please check and try again.",
            icon: <XCircle className="w-12 h-12 mx-auto text-red-500" />,
            color: "red",
            action: resetPayment
          }
        case "service-unavailable":
          return {
            title: "Service Unavailable",
            message: "M-Pesa services are temporarily unavailable. Please try again later.",
            icon: <XCircle className="w-12 h-12 mx-auto text-red-500" />,
            color: "red",
            action: resetPayment
          }
        default:
          return {
            title: "Payment Status",
            message: "Unknown payment status.",
            icon: <XCircle className="w-12 h-12 mx-auto text-gray-500" />,
            color: "gray",
            action: resetPayment
          }
      }
    }

    const status = getStatusMessage()

    return (
      <div className={`bg-${status.color}-900/20 border border-${status.color}-800 rounded-lg p-6 text-center`}>
        <div className="mb-4">
          {status.icon}
        </div>
        <h3 className={`text-xl font-bold text-${status.color}-500 mb-2`}>
          {status.title}
        </h3>
        <p className={`text-${status.color}-300 mb-4`}>
          {status.message}
        </p>
        {transactionDetails?.Amount && (
          <p className="text-white mb-2">
            Amount: KES {transactionDetails.Amount.toLocaleString()}
          </p>
        )}
        {transactionDetails?.TransactionDate && (
          <p className="text-gray-400 text-sm">
            {new Date(transactionDetails.TransactionDate).toLocaleString()}
          </p>
        )}
        <Button 
          onClick={status.action}
          className={`bg-${status.color}-600 hover:bg-${status.color}-700 mt-4`}
        >
          {paymentStatus === "success" ? "Continue to Dashboard" : "Try Again"}
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-md mx-auto">
        {/* Back & Header */}
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-yellow-400 hover:text-yellow-300 mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Game
          </Link>
          <h1 className="text-2xl font-bold text-yellow-400">Deposit Funds</h1>
          <p className="text-gray-400 mt-2">Transactions are saved immediately after initiating payment</p>
        </div>

        {/* Show payment status or form */}
        {paymentStatus !== "idle" ? (
          <PaymentStatusDisplay />
        ) : (
          <>
            {/* Method Selector */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              <Button
                variant={depositMethod === "mpesa" ? "default" : "outline"}
                onClick={() => setDepositMethod("mpesa")}
                className="flex flex-col items-center p-4 h-auto"
              >
                <Smartphone className="w-6 h-6 mb-2" />
                <span className="text-xs">M-Pesa</span>
              </Button>
              <Button
                variant={depositMethod === "card" ? "default" : "outline"}
                onClick={() => setDepositMethod("card")}
                className="flex flex-col items-center p-4 h-auto"
              >
                <CreditCard className="w-6 h-6 mb-2" />
                <span className="text-xs">Card</span>
              </Button>
              <Button
                variant={depositMethod === "bank" ? "default" : "outline"}
                onClick={() => setDepositMethod("bank")}
                className="flex flex-col items-center p-4 h-auto"
              >
                <Banknote className="w-6 h-6 mb-2" />
                <span className="text-xs">Bank</span>
              </Button>
            </div>

            {/* M-Pesa Deposit Form */}
            {depositMethod === "mpesa" && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <Smartphone className="w-5 h-5 mr-2 text-green-500" />
                    M-Pesa Deposit
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Transactions are saved immediately after initiating payment
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleMpesaDeposit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="deposit-name" className="text-white">
                        Full Name
                      </Label>
                      <Input
                        id="deposit-name"
                        type="text"
                        placeholder="John Doe"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-gray-700 border-gray-600 text-white"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="deposit-email" className="text-white">
                        Email Address
                      </Label>
                      <Input
                        id="deposit-email"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-gray-700 border-gray-600 text-white"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="mpesa-phone" className="text-white">
                        M-Pesa Number
                      </Label>
                      <Input
                        id="mpesa-phone"
                        type="tel"
                        placeholder="2547XXXXXXXX"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="bg-gray-700 border-gray-600 text-white"
                        required
                      />
                      <p className="text-xs text-gray-400">Format: 2547XXXXXXXX</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="mpesa-amount" className="text-white">
                        Amount ($)
                      </Label>
                      <Input
                        id="mpesa-amount"
                        type="number"
                        placeholder="100"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="bg-gray-700 border-gray-600 text-white"
                        min="100"
                        required
                      />
                      <p className="text-xs text-gray-400">KES {kshAmount.toLocaleString()}</p>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {quickAmounts.map((amt) => (
                        <Button
                          key={amt}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setAmount(amt.toString())}
                          className="bg-gray-700 border-gray-600 text-white"
                        >
                          ${amt}
                        </Button>
                      ))}
                    </div>

                    <Button
                      type="submit"
                      disabled={isLoading || !amount || !phoneNumber || !name || !email}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3"
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center">
                          <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                          Processing...
                        </span>
                      ) : (
                        `Deposit $${amount} USD`
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Card Payment Form */}
            {depositMethod === "card" && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <CreditCard className="w-5 h-5 mr-2 text-blue-500" />
                    Card Payment
                  </CardTitle>
                  <CardDescription className="text-gray-400">Pay with your credit or debit card</CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="card-name" className="text-white">
                        Name on Card
                      </Label>
                      <Input
                        id="card-name"
                        type="text"
                        placeholder="John Doe"
                        name="name"
                        value={cardDetails.name}
                        onChange={handleCardDetailsChange}
                        className="bg-gray-700 border-gray-600 text-white"
                        disabled
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="card-number" className="text-white">
                        Card Number
                      </Label>
                      <Input
                        id="card-number"
                        type="text"
                        placeholder="4242 4242 4242 4242"
                        name="number"
                        value={cardDetails.number}
                        onChange={handleCardDetailsChange}
                        className="bg-gray-700 border-gray-600 text-white"
                        disabled
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="card-expiry" className="text-white">
                          Expiry Date
                        </Label>
                        <Input
                          id="card-expiry"
                          type="text"
                          placeholder="MM/YY"
                          name="expiry"
                          value={cardDetails.expiry}
                          onChange={handleCardDetailsChange}
                          className="bg-gray-700 border-gray-600 text-white"
                          disabled
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="card-cvv" className="text-white">
                          CVV
                        </Label>
                        <Input
                          id="card-cvv"
                          type="text"
                          placeholder="123"
                          name="cvv"
                          value={cardDetails.cvv}
                          onChange={handleCardDetailsChange}
                          className="bg-gray-700 border-gray-600 text-white"
                          disabled
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="card-amount" className="text-white">
                        Amount ($)
                      </Label>
                      <Input
                        id="card-amount"
                        type="number"
                        placeholder="100"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="bg-gray-700 border-gray-600 text-white"
                        min="100"
                        disabled
                      />
                      <p className="text-xs text-gray-400">KES {kshAmount.toLocaleString()}</p>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {quickAmounts.map((amt) => (
                        <Button
                          key={amt}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setAmount(amt.toString())}
                          className="bg-gray-700 border-gray-600 text-white"
                          disabled
                        >
                          ${amt}
                        </Button>
                      ))}
                    </div>

                    <div className="border border-dashed border-blue-500 rounded-lg p-6 text-center bg-blue-900/10">
                      <CreditCard className="w-10 h-10 mx-auto text-blue-400 mb-3" />
                      <h3 className="font-medium text-white">Card Payment not Accepted in your country use Phone Transfer option</h3>
                      <p className="text-sm text-gray-400 mt-1">
                        We'll notify you soon
                      </p>
                    </div>

                    <Button
                      type="button"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3"
                      disabled
                    >
                      Pay with Card
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Bank Transfer Form */}
            {depositMethod === "bank" && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <Banknote className="w-5 h-5 mr-2 text-purple-500" />
                    Bank Transfer
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Transfer directly from your bank account
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="bank-name" className="text-white">
                        Full Name
                      </Label>
                      <Input
                        id="bank-name"
                        type="text"
                        placeholder="As shown on bank account"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-gray-700 border-gray-600 text-white"
                        disabled
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bank-account" className="text-white">
                        Bank Account Number
                      </Label>
                      <Input
                        id="bank-account"
                        type="text"
                        placeholder="1234567890"
                        className="bg-gray-700 border-gray-600 text-white"
                        disabled
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bank-name" className="text-white">
                        Bank Name
                      </Label>
                      <select
                        id="bank-name"
                        className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 border"
                        disabled
                      >
                        <option value="">Select your bank</option>
                        <option value="equity">Equity Bank</option>
                        <option value="kcb">KCB Bank</option>
                        <option value="coop">Co-operative Bank</option>
                        <option value="standard">Standard Chartered</option>
                        <option value="absa">Absa Bank</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bank-amount" className="text-white">
                        Amount ($)
                      </Label>
                      <Input
                        id="bank-amount"
                        type="number"
                        placeholder="100"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="bg-gray-700 border-gray-600 text-white"
                        min="100"
                        disabled
                      />
                      <p className="text-xs text-gray-400">KES {kshAmount.toLocaleString()}</p>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {quickAmounts.map((amt) => (
                        <Button
                          key={amt}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setAmount(amt.toString())}
                          className="bg-gray-700 border-gray-600 text-white"
                          disabled
                        >
                          ${amt}
                        </Button>
                      ))}
                    </div>

                    <div className="border border-dashed border-purple-500 rounded-lg p-6 text-center bg-purple-900/10">
                      <Banknote className="w-10 h-10 mx-auto text-purple-400 mb-3" />
                      <h3 className="font-medium text-white">Bank Transfers Not allowed from your location, use phone transfer option</h3>
                      <p className="text-sm text-gray-400 mt-1">
                        We'll let you know.
                      </p>
                    </div>

                    <Button
                      type="button"
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3"
                      disabled
                    >
                      Pay with Bank
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Transaction Information */}
            <Card className="bg-gray-800 border-gray-700 mt-6">
              <CardHeader>
                <CardTitle className="text-white text-lg">Deposit Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Minimum deposit:</span>
                    <span className="text-white">$100</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Processing time:</span>
                    <span className="text-white">Instant (M-Pesa)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Exchange rate:</span>
                    <span className="text-white">1 USD = 130 KES</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}