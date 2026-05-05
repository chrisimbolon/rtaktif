"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";

const initialPayments = [
  { id: 1, name: "Budi", amount: "50.000", status: "pending" },
  { id: 2, name: "Siti", amount: "50.000", status: "paid" },
];

export default function PembayaranPage() {
  const [payments, setPayments] = useState(initialPayments);
  const [selected, setSelected] = useState<any>(null);

  const handleApprove = () => {
    setPayments((prev) =>
      prev.map((p) =>
        p.id === selected.id ? { ...p, status: "paid" } : p
      )
    );

    toast.success("Pembayaran berhasil dikonfirmasi");

    setSelected(null);
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Konfirmasi Pembayaran</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th>Nama</th>
                <th>Jumlah</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b">
                  <td>{p.name}</td>
                  <td>Rp {p.amount}</td>
                  <td>
                    {p.status === "pending" ? "Menunggu" : "Lunas"}
                  </td>
                  <td>
                    {p.status === "pending" && (
                      <Button
                        size="sm"
                        onClick={() => setSelected(p)}
                      >
                        Approve
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* MODAL */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Pembayaran</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-gray-600">
            Apakah Anda yakin ingin mengonfirmasi pembayaran dari{" "}
            <strong>{selected?.name}</strong>?
          </p>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setSelected(null)}
            >
              Batal
            </Button>
            <Button onClick={handleApprove}>
              Ya, Konfirmasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}