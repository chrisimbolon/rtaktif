import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const residents = [
  { id: 1, name: "Budi", house: "A1", phone: "08123456789" },
  { id: 2, name: "Siti", house: "A2", phone: "08123456788" },
];

export default function WargaPage() {
  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Data Warga</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th>Nama</th>
                <th>Rumah</th>
                <th>No HP</th>
              </tr>
            </thead>
            <tbody>
              {residents.map((r) => (
                <tr key={r.id} className="border-b">
                  <td>{r.name}</td>
                  <td>{r.house}</td>
                  <td>{r.phone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}