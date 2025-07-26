"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Textarea from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Plus, Trash2, Download, Building2, Upload, X, Edit } from "lucide-react"
import jsPDF from "jspdf"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

interface LineItem {
  id: string
  description: string
  quantity: number
  rate: number
  amount: number
}

interface InvoiceData {
  invoiceNumber: string
  date: string
  dueDate: string
  notes: string
  taxRate: number // Moved taxRate here to be per-invoice/per-customer
}

interface ContractorDetails {
  id: string // Unique ID for each contractor
  name: string
  address: string
  email: string
  phone: string
  invoice: InvoiceData // Nested invoice data
  lineItems: LineItem[] // Nested line items
}

interface CompanyDetails {
  name: string
  tagline: string
  logo: string | null
}

const LOCAL_STORAGE_KEY = "invoiceGeneratorData"

// Helper to create a new default contractor with initial invoice/line items
const createDefaultContractor = (): ContractorDetails => ({
  id: crypto.randomUUID(),
  name: "New Customer",
  address: "",
  email: "",
  phone: "",
  invoice: {
    invoiceNumber: `INV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    date: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    notes: "",
    taxRate: 0,
  },
  lineItems: [
    {
      id: "1",
      description: "",
      quantity: 1,
      rate: 0,
      amount: 0,
    },
  ],
})

export default function InvoiceGenerator() {
  const [company, setCompany] = useState<CompanyDetails>({
    name: "Your Company Name",
    tagline: "Professional Services",
    logo: null,
  })

  const [contractors, setContractors] = useState<ContractorDetails[]>([])
  const [selectedContractorId, setSelectedContractorId] = useState<string | null>(null)

  // Derived state for the currently active contractor
  const selectedContractor = selectedContractorId ? contractors.find((c) => c.id === selectedContractorId) : null

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<ContractorDetails | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split("-").map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)
  }

  // Load data from local storage on initial mount
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (savedData) {
        const parsedData = JSON.parse(savedData)
        setCompany(parsedData.company || company)
        const loadedContractors = parsedData.contractors || []
        setContractors(loadedContractors)
        // Ensure a contractor is selected, or create a default one if none exist
        if (loadedContractors.length > 0) {
          setSelectedContractorId(parsedData.selectedContractorId || loadedContractors[0].id)
        } else {
          const defaultContractor = createDefaultContractor()
          setContractors([defaultContractor])
          setSelectedContractorId(defaultContractor.id)
        }
      } else {
        // If no data in local storage, create a fresh default contractor
        const defaultContractor = createDefaultContractor()
        setContractors([defaultContractor])
        setSelectedContractorId(defaultContractor.id)
      }
    } catch (error) {
      console.error("Failed to load data from local storage:", error)
      localStorage.removeItem(LOCAL_STORAGE_KEY)
      // Fallback to a fresh default contractor on error
      const defaultContractor = createDefaultContractor()
      setContractors([defaultContractor])
      setSelectedContractorId(defaultContractor.id)
    }
  }, [])

  // Save data to local storage whenever relevant state changes
  useEffect(() => {
    const dataToSave = {
      company,
      contractors,
      selectedContractorId,
    }
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave))
    } catch (error) {
      console.error("Failed to save data to local storage:", error)
    }
  }, [company, contractors, selectedContractorId])

  // Helper to update the currently selected contractor's nested data
  const updateSelectedContractor = useCallback(
    (updater: (prev: ContractorDetails) => ContractorDetails) => {
      if (!selectedContractorId) return // Should not happen if initial state is handled correctly

      setContractors((prevContractors) => prevContractors.map((c) => (c.id === selectedContractorId ? updater(c) : c)))
    },
    [selectedContractorId],
  )

  const addLineItem = () => {
    updateSelectedContractor((prev) => ({
      ...prev,
      lineItems: [
        ...prev.lineItems,
        {
          id: Date.now().toString(),
          description: "",
          quantity: 1,
          rate: 0,
          amount: 0,
        },
      ],
    }))
  }

  const removeLineItem = (id: string) => {
    updateSelectedContractor((prev) => {
      const updatedLineItems = prev.lineItems.filter((item) => item.id !== id)
      // Ensure there's always at least one line item
      if (updatedLineItems.length === 0) {
        return {
          ...prev,
          lineItems: [{ id: "1", description: "", quantity: 1, rate: 0, amount: 0 }],
        }
      }
      return { ...prev, lineItems: updatedLineItems }
    })
  }

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    updateSelectedContractor((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value }
          if (field === "quantity" || field === "rate") {
            updatedItem.amount = updatedItem.quantity * updatedItem.rate
          }
          return updatedItem
        }
        return item
      }),
    }))
  }

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setCompany({ ...company, logo: e.target?.result as string })
      }
      reader.readAsDataURL(file)
    }
  }

  const removeLogo = () => {
    setCompany({ ...company, logo: null })
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const generateNewInvoiceNumber = () => {
    updateSelectedContractor((prev) => ({
      ...prev,
      invoice: {
        ...prev.invoice,
        invoiceNumber: `INV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      },
    }))
  }

  const currentSubtotal = selectedContractor?.lineItems.reduce((sum, item) => sum + item.amount, 0) || 0
  const currentTaxAmount = currentSubtotal * ((selectedContractor?.invoice.taxRate || 0) / 100)
  const currentTotal = currentSubtotal + currentTaxAmount

  const handleAddCustomer = () => {
    setEditingCustomer(createDefaultContractor()) // Start with a fresh default customer
    setIsCustomerModalOpen(true)
  }

  const handleEditCustomer = () => {
    if (selectedContractor) {
      setEditingCustomer({ ...selectedContractor }) // Clone for editing
      setIsCustomerModalOpen(true)
    }
  }

  const handleDeleteCustomer = () => {
    if (selectedContractorId) {
      const updatedContractors = contractors.filter((c) => c.id !== selectedContractorId)
      setContractors(updatedContractors)
      // Select a new contractor or create a default one if none left
      if (updatedContractors.length > 0) {
        setSelectedContractorId(updatedContractors[0].id)
      } else {
        const defaultContractor = createDefaultContractor()
        setContractors([defaultContractor])
        setSelectedContractorId(defaultContractor.id)
      }
    }
  }

  const handleSaveCustomer = (customer: ContractorDetails) => {
    if (contractors.some((c) => c.id === customer.id)) {
      // Editing existing customer
      setContractors(contractors.map((c) => (c.id === customer.id ? customer : c)))
    } else {
      // Adding new customer
      setContractors([...contractors, customer])
      setSelectedContractorId(customer.id) // Select the newly added customer
    }
    setIsCustomerModalOpen(false)
    setEditingCustomer(null)
  }

  const generatePDF = useCallback(() => {
    if (!selectedContractor) return // Cannot generate PDF without a selected contractor

    const doc = new jsPDF()
    const pageHeight = doc.internal.pageSize.getHeight()
    const pageWidth = doc.internal.pageSize.getWidth()
    const rightMargin = 20
    const topMargin = 20

    doc.setFont("helvetica")

    // Invoice details (left side)
    doc.setFontSize(24)
    doc.setTextColor(40, 40, 40)
    doc.text("INVOICE", 20, 30)

    doc.setFontSize(12)
    doc.setTextColor(100, 100, 100)
    doc.text(`Invoice #${selectedContractor.invoice.invoiceNumber}`, 20, 40)

    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    doc.text("Invoice Date:", 20, 55)
    doc.text("Due Date:", 20, 63)

    doc.setTextColor(40, 40, 40)
    doc.text(formatDate(selectedContractor.invoice.date), 50, 55)
    doc.text(formatDate(selectedContractor.invoice.dueDate), 50, 63)

    const finalizePdfContent = () => {
      // Bill To section
      doc.setFontSize(12)
      doc.setTextColor(40, 40, 40)
      doc.text("Bill To:", 20, 90)

      doc.setFontSize(10)
      let yPos = 100
      if (selectedContractor.name) {
        doc.text(selectedContractor.name, 20, yPos)
        yPos += 8
      }
      if (selectedContractor.address) {
        const addressLines = selectedContractor.address.split("\n")
        addressLines.forEach((line) => {
          doc.text(line, 20, yPos)
          yPos += 6
        })
        yPos += 2
      }
      if (selectedContractor.email) {
        doc.text(selectedContractor.email, 20, yPos)
        yPos += 8
      }
      if (selectedContractor.phone) {
        doc.text(selectedContractor.phone, 20, yPos)
        yPos += 8
      }

      // Line items table
      yPos += 10
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)

      // Table headers
      doc.text("Description", 20, yPos)
      doc.text("Qty", 120, yPos)
      doc.text("Rate", 140, yPos)
      doc.text("Amount", 170, yPos)

      // Table header line
      yPos += 2
      doc.setDrawColor(200, 200, 200)
      doc.line(20, yPos, 190, yPos)
      yPos += 8

      // Table rows
      doc.setTextColor(40, 40, 40)
      selectedContractor.lineItems.forEach((item) => {
        if (item.description || item.quantity > 0 || item.rate > 0) {
          const description = item.description || "No description"
          const splitDescription = doc.splitTextToSize(description, 90)

          doc.text(splitDescription, 20, yPos)
          doc.text(item.quantity.toString(), 120, yPos)
          doc.text(`$${item.rate.toFixed(2)}`, 140, yPos)
          doc.text(formatCurrency(item.amount), 170, yPos)

          yPos += Math.max(8, splitDescription.length * 6)
        }
      })

      // Totals section
      yPos += 10
      doc.setDrawColor(200, 200, 200)
      doc.line(120, yPos, 190, yPos)
      yPos += 8

      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      doc.text("Subtotal:", 140, yPos)
      doc.setTextColor(40, 40, 40)
      doc.text(formatCurrency(currentSubtotal), 170, yPos)
      yPos += 8

      if (selectedContractor.invoice.taxRate > 0) {
        doc.setTextColor(100, 100, 100)
        doc.text(`Tax (${selectedContractor.invoice.taxRate}%):`, 140, yPos)
        doc.setTextColor(40, 40, 40)
        doc.text(formatCurrency(currentTaxAmount), 170, yPos)
        yPos += 8
      }

      // Total line
      doc.setDrawColor(200, 200, 200)
      doc.line(120, yPos, 190, yPos)
      yPos += 8

      doc.setFontSize(12)
      doc.setTextColor(40, 40, 40)
      doc.text("Total:", 140, yPos)
      doc.setFont("helvetica", "bold")
      doc.text(formatCurrency(currentTotal), 170, yPos)

      // Notes section
      if (selectedContractor.invoice.notes) {
        yPos += 20
        doc.setFont("helvetica", "normal")
        doc.setFontSize(10)
        doc.setTextColor(100, 100, 100)
        doc.text("Notes:", 20, yPos)
        yPos += 8

        doc.setTextColor(40, 40, 40)
        const noteLines = doc.splitTextToSize(selectedContractor.invoice.notes, 170)
        doc.text(noteLines, 20, yPos)
      }

      doc.save(`invoice-${selectedContractor.invoice.invoiceNumber}.pdf`)
    }

    const logoWidth = 15 // mm
    const logoHeight = 15 // mm
    const logoX = pageWidth - rightMargin - logoWidth
    const logoY = topMargin

    if (company.logo) {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas")
          const ctx = canvas.getContext("2d")

          const MAX_LOGO_DIMENSION = 150

          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > MAX_LOGO_DIMENSION) {
              height *= MAX_LOGO_DIMENSION / width
              width = MAX_LOGO_DIMENSION
            }
          } else {
            if (height > MAX_LOGO_DIMENSION) {
              width *= MAX_LOGO_DIMENSION / height
              height = MAX_LOGO_DIMENSION
            }
          }

          canvas.width = width
          canvas.height = height
          ctx?.drawImage(img, 0, 0, width, height)

          const imgData = canvas.toDataURL("image/png")

          doc.addImage(imgData, "PNG", logoX, logoY, logoWidth, logoHeight)

          doc.setFontSize(12)
          doc.setTextColor(40, 40, 40)
          doc.text(company.name, pageWidth - rightMargin, logoY + logoHeight + 5, { align: "right" })

          doc.setFontSize(9)
          doc.setTextColor(100, 100, 100)
          doc.text(company.tagline, pageWidth - rightMargin, logoY + logoHeight + 10, { align: "right" })

          finalizePdfContent()
        } catch (error) {
          console.error("Error drawing logo to canvas or PDF:", error)
          doc.setFontSize(12)
          doc.setTextColor(40, 40, 40)
          doc.text(company.name, pageWidth - rightMargin, logoY + logoHeight + 5, { align: "right" })
          doc.setFontSize(9)
          doc.setTextColor(100, 100, 100)
          doc.text(company.tagline, pageWidth - rightMargin, logoY + logoHeight + 10, { align: "right" })
          finalizePdfContent()
        }
      }
      img.onerror = (error) => {
        console.error("Error loading logo image:", error)
        doc.setFontSize(12)
        doc.setTextColor(40, 40, 40)
        doc.text(company.name, pageWidth - rightMargin, logoY + logoHeight + 5, { align: "right" })
        doc.setFontSize(9)
        doc.setTextColor(100, 100, 100)
        doc.text(company.tagline, pageWidth - rightMargin, logoY + logoHeight + 10, { align: "right" })
        finalizePdfContent()
      }
      img.src = company.logo
    } else {
      doc.setFontSize(16)
      doc.setTextColor(40, 40, 40)
      doc.text(company.name, pageWidth - rightMargin, topMargin + 10, { align: "right" })
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      doc.text(company.tagline, pageWidth - rightMargin, topMargin + 18, { align: "right" })
      finalizePdfContent()
    }
  }, [company, selectedContractor, currentSubtotal, currentTaxAmount, currentTotal])

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Header */}
        <Card className="border-0 shadow-md overflow-hidden">
          <CardContent className="p-6 sm:p-8 relative">
            <div className="flex flex-col-reverse sm:flex-row sm:items-start justify-between gap-6">
              {/* Invoice Title and Number (Left) */}
              <div className="text-left">
                <h2 className="text-3xl font-bold text-gray-900">INVOICE</h2>
                <p className="text-gray-600 mt-1">#{selectedContractor?.invoice.invoiceNumber}</p>
              </div>

              {/* Company Details (Right) */}
              <div className="flex flex-col items-start sm:items-end space-y-2 sm:space-y-0 sm:space-x-4 sm:flex-row-reverse">
                {company.logo ? (
                  <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg flex-shrink-0">
                    <img
                      src={company.logo || "/placeholder.svg"}
                      alt="Company Logo"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-b from-blue-400 to-blue-600 shadow-lg transform transition-all duration-200 hover:scale-105 flex-shrink-0">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                )}
                <div className="text-left sm:text-right">
                  <h1 className="text-2xl font-semibold text-gray-900">{company.name}</h1>
                  <p className="text-gray-600">{company.tagline}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company Details */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-medium text-gray-900">Company Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="company-name" className="text-sm font-medium text-gray-700">
                  Company Name
                </Label>
                <Input
                  id="company-name"
                  value={company.name}
                  onChange={(e) => setCompany({ ...company, name: e.target.value })}
                  placeholder="Enter your company name"
                  className="mt-1 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <Label htmlFor="company-tagline" className="text-sm font-medium text-gray-700">
                  Tagline
                </Label>
                <Input
                  id="company-tagline"
                  value={company.tagline}
                  onChange={(e) => setCompany({ ...company, tagline: e.target.value })}
                  placeholder="Enter your company tagline"
                  className="mt-1 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">Company Logo</Label>
              <div className="mt-1 flex items-center gap-4">
                {company.logo ? (
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                      <img
                        src={company.logo || "/placeholder.svg"}
                        alt="Company Logo"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="border-gray-300"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Change Logo
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={removeLogo}
                        className="border-gray-300 text-red-600 hover:text-red-700 bg-transparent"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="border-gray-300 border-dashed h-16 px-6"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Logo
                  </Button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </div>
              <p className="text-xs text-gray-500 mt-2">Recommended: Square image, max 2MB (PNG, JPG, SVG)</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Contractor Details */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-medium text-gray-900">Bill To</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="select-contractor" className="text-sm font-medium text-gray-700">
                  Select Customer
                </Label>
                <div className="flex gap-2 mt-1">
                  <Select onValueChange={setSelectedContractorId} value={selectedContractorId || ""}>
                    <SelectTrigger id="select-contractor" className="flex-1">
                      <SelectValue placeholder="Select a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {contractors.map((contractor) => (
                        <SelectItem key={contractor.id} value={contractor.id}>
                          {contractor.name || "Unnamed Customer"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" onClick={handleAddCustomer} title="Add New Customer">
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleEditCustomer}
                    disabled={!selectedContractorId}
                    title="Edit Selected Customer"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleDeleteCustomer}
                    disabled={!selectedContractorId || contractors.length === 1} // Prevent deleting the last customer
                    title="Delete Selected Customer"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>

              {selectedContractor ? (
                <>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Name</Label>
                    <Input value={selectedContractor.name} disabled className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Address</Label>
                    <Textarea value={selectedContractor.address} disabled className="mt-1 resize-none" rows={3} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Email</Label>
                      <Input value={selectedContractor.email} disabled className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Phone</Label>
                      <Input value={selectedContractor.phone} disabled className="mt-1" />
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-gray-500 text-sm">No customer selected. Add a new customer to get started.</p>
              )}
            </CardContent>
          </Card>

          {/* Invoice Details */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-medium text-gray-900">Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="invoice-number" className="text-sm font-medium text-gray-700">
                    Invoice Number
                  </Label>
                  <Input
                    id="invoice-number"
                    value={selectedContractor?.invoice.invoiceNumber || ""}
                    onChange={(e) =>
                      updateSelectedContractor((prev) => ({
                        ...prev,
                        invoice: { ...prev.invoice, invoiceNumber: e.target.value },
                      }))
                    }
                    className="mt-1 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateNewInvoiceNumber}
                    className="border-gray-300 hover:bg-gray-50 bg-transparent"
                    title="Generate new invoice number"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="invoice-date" className="text-sm font-medium text-gray-700">
                    Invoice Date
                  </Label>
                  <Input
                    id="invoice-date"
                    type="date"
                    value={selectedContractor?.invoice.date || ""}
                    onChange={(e) =>
                      updateSelectedContractor((prev) => ({
                        ...prev,
                        invoice: { ...prev.invoice, date: e.target.value },
                      }))
                    }
                    className="mt-1 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <Label htmlFor="due-date" className="text-sm font-medium text-gray-700">
                    Due Date
                  </Label>
                  <Input
                    id="due-date"
                    type="date"
                    value={selectedContractor?.invoice.dueDate || ""}
                    onChange={(e) =>
                      updateSelectedContractor((prev) => ({
                        ...prev,
                        invoice: { ...prev.invoice, dueDate: e.target.value },
                      }))
                    }
                    className="mt-1 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="tax-rate" className="text-sm font-medium text-gray-700">
                  Tax Rate (%)
                </Label>
                <Input
                  id="tax-rate"
                  type="number"
                  value={selectedContractor?.invoice.taxRate || 0}
                  onChange={(e) =>
                    updateSelectedContractor((prev) => ({
                      ...prev,
                      invoice: { ...prev.invoice, taxRate: Number(e.target.value) },
                    }))
                  }
                  placeholder="0"
                  className="mt-1 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  min="0"
                  max="100"
                  step="0.01"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Line Items */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-lg font-medium text-gray-900">Line Items</CardTitle>
              <Button
                onClick={addLineItem}
                size="sm"
                className="bg-gradient-to-b from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white shadow-md transition-all duration-200"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-4 sm:-mx-6">
              <div className="inline-block min-w-full align-middle px-4 sm:px-6">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-200">
                      <TableHead className="text-gray-700 font-medium">Description</TableHead>
                      <TableHead className="text-gray-700 font-medium w-20 sm:w-24">Qty</TableHead>
                      <TableHead className="text-gray-700 font-medium w-28 sm:w-32">Price/Rate</TableHead>
                      <TableHead className="text-gray-700 font-medium w-28 sm:w-32">Amount</TableHead>
                      <TableHead className="w-10 sm:w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedContractor?.lineItems.map((item) => (
                      <TableRow key={item.id} className="border-gray-200">
                        <TableCell className="py-3">
                          <Input
                            value={item.description}
                            onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                            placeholder="Description of work performed"
                            className="border-0 p-0 h-auto focus-visible:ring-0 focus:border-0"
                          />
                        </TableCell>
                        <TableCell className="py-3">
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(item.id, "quantity", Number(e.target.value))}
                            className="border-0 p-0 h-auto focus-visible:ring-0 focus:border-0"
                            min="0"
                            step="0.01"
                          />
                        </TableCell>
                        <TableCell className="py-3">
                          <Input
                            type="number"
                            value={item.rate}
                            onChange={(e) => updateLineItem(item.id, "rate", Number(e.target.value))}
                            className="border-0 p-0 h-auto focus-visible:ring-0 focus:border-0"
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                          />
                        </TableCell>
                        <TableCell className="font-medium py-3">{formatCurrency(item.amount)}</TableCell>
                        <TableCell className="py-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLineItem(item.id)}
                            disabled={selectedContractor.lineItems.length === 1}
                            className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Totals and Notes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Notes */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-medium text-gray-900">Notes & Terms</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={selectedContractor?.invoice.notes || ""}
                onChange={(e) =>
                  updateSelectedContractor((prev) => ({
                    ...prev,
                    invoice: { ...prev.invoice, notes: e.target.value },
                  }))
                }
                placeholder="Payment terms, additional notes, or special instructions..."
                rows={6}
                className="resize-none border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </CardContent>
          </Card>

          {/* Totals */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-medium text-gray-900">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{formatCurrency(currentSubtotal)}</span>
              </div>
              {selectedContractor?.invoice.taxRate > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Tax ({selectedContractor.invoice.taxRate}%)</span>
                  <span className="font-medium">{formatCurrency(currentTaxAmount)}</span>
                </div>
              )}
              <Separator className="bg-gray-200" />
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">Total</span>
                <span className="text-lg font-bold text-gray-900">{formatCurrency(currentTotal)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-end">
              <Button
                variant="outline"
                className="flex items-center border-gray-300 hover:bg-gray-50 transition-colors duration-200 bg-transparent"
                onClick={generatePDF}
                disabled={!selectedContractor}
              >
                <Download className="w-4 h-4 mr-2" />
                Download as PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center py-6 border-t border-gray-200 mt-8">
          <p className="text-sm text-gray-600">2025 © Suresh Kaleyannan</p>
        </div>
      </div>

      {/* Customer Add/Edit Dialog */}
      <Dialog open={isCustomerModalOpen} onOpenChange={setIsCustomerModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingCustomer?.id && contractors.some((c) => c.id === editingCustomer.id)
                ? "Edit Customer"
                : "Add New Customer"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="customer-name" className="text-right">
                Name
              </Label>
              <Input
                id="customer-name"
                value={editingCustomer?.name || ""}
                onChange={(e) => setEditingCustomer((prev) => ({ ...prev!, name: e.target.value }))}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="customer-address" className="text-right">
                Address
              </Label>
              <Textarea
                id="customer-address"
                value={editingCustomer?.address || ""}
                onChange={(e) => setEditingCustomer((prev) => ({ ...prev!, address: e.target.value }))}
                className="col-span-3 resize-none"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="customer-email" className="text-right">
                Email
              </Label>
              <Input
                id="customer-email"
                type="email"
                value={editingCustomer?.email || ""}
                onChange={(e) => setEditingCustomer((prev) => ({ ...prev!, email: e.target.value }))}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="customer-phone" className="text-right">
                Phone
              </Label>
              <Input
                id="customer-phone"
                value={editingCustomer?.phone || ""}
                onChange={(e) => setEditingCustomer((prev) => ({ ...prev!, phone: e.target.value }))}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => handleSaveCustomer(editingCustomer!)}
              disabled={!editingCustomer?.name} // Require at least a name
            >
              Save Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
