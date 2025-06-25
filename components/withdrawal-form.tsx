"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X } from "lucide-react"

interface WithdrawalFormProps {
  onClose: () => void
  onWithdraw: (amount: number, method: "phone" | "bank", details: string) => Promise<void>
  balance: number
}

export function WithdrawalForm({ onClose, onWithdraw, balance }: WithdrawalFormProps) {
  const [amount, setAmount] = useState<number>(10000)
  const [method, setMethod] = useState<"phone" | "bank">("phone")
  const [details, setDetails] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const handleSubmit = async () => {
    setError(null)
    if (amount < 10000) {
      setError("Minimum withdrawal amount is $10000.")
      return
    }
    if (amount > balance) {
      setError("Insufficient balance.")
      return
    }
    if (!details.trim()) {
      setError(`Please enter your ${method === "phone" ? "phone number" : "bank details"}.`)
      return
    }

    setIsSubmitting(true)
    try {
      await onWithdraw(amount, method, details)
      onClose() // Close form on successful withdrawal
    } catch (err: any) {
      setError(err.message || "Withdrawal failed. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-gray-900 rounded-lg shadow-lg p-6 w-96 max-w-full relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-white"
          aria-label="Close withdrawal form"
        >
          <X className="w-5 h-5" />
        </Button>
        <h2 className="text-2xl font-bold text-white mb-4 text-center">Withdraw Funds</h2>

        {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}

        <div className="mb-4">
          <Label htmlFor="withdrawal-amount" className="block text-sm font-medium text-gray-300 mb-1">
            Amount (USD)
          </Label>
          <Input
            id="withdrawal-amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            min={10000}
            step={10}
            className="bg-gray-800 border border-gray-700 text-white"
          />
          <p className="text-xs text-gray-400 mt-1">
            Minimum withdrawal: $10000. Your current balance: ${balance.toFixed(2)}
          </p>
        </div>

        <div className="mb-4">
          <Label className="block text-sm font-medium text-gray-300 mb-1">Withdrawal Method</Label>
          <div className="flex space-x-2">
            <Button
              variant={method === "phone" ? "default" : "outline"}
              onClick={() => {
                setMethod("phone")
                setDetails("")
              }}
              className={method === "phone" ? "bg-green-600 text-white" : "bg-gray-700 border-gray-600 text-gray-300"}
            >
              Phone (M-Pesa)
            </Button>
            <Button
              variant={method === "bank" ? "default" : "outline"}
              onClick={() => {
                setMethod("bank")
                setDetails("")
              }}
              className={method === "bank" ? "bg-green-600 text-white" : "bg-gray-700 border-gray-600 text-gray-300"}
            >
              Bank
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <Label htmlFor="withdrawal-details" className="block text-sm font-medium text-gray-300 mb-1">
            {method === "phone" ? "Phone Number" : "Bank Account Details (Bank Name, Account No., Name)"}
          </Label>
          <Input
            id="withdrawal-details"
            type="text"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder={method === "phone" ? "e.g., +2547XXXXXXXX" : "e.g., KCB, 1234567890, John Doe"}
            className="bg-gray-800 border border-gray-700 text-white"
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 text-lg"
        >
          {isSubmitting ? "Processing..." : `Withdraw $${amount.toFixed(2)}`}
        </Button>
      </div>
    </div>
  )
}