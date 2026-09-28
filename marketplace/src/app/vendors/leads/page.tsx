"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Lead {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  message: string;
  status: string;
  createdAt: string;
  product: {
    id: string;
    name: string;
    slug: string;
  };
}

export default function VendorLeadsPage() {
  const router = useRouter();

  // Redirect to partners dashboard - Vendor portal is hidden
  useEffect(() => {
    router.push('/partners/dashboard');
  }, [router]);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/vendors/leads?status=${selectedStatus}&page=${page}`);
      const data = await response.json();

      if (response.ok) {
        setLeads(data.data);
        setTotalPages(data.meta.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch leads:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [selectedStatus, page]);

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/vendors/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        fetchLeads(); // Refresh the list
      }
    } catch (error) {
      console.error('Failed to update lead status:', error);
    }
  };

  const exportToCSV = () => {
    if (leads.length === 0) return;

    const headers = ['Date', 'Name', 'Email', 'Company', 'Phone', 'Product', 'Status', 'Message'];
    const rows = leads.map(lead => [
      new Date(lead.createdAt).toLocaleDateString(),
      lead.name,
      lead.email,
      lead.company || 'N/A',
      lead.phone || 'N/A',
      lead.product.name,
      lead.status,
      lead.message.replace(/"/g, '""'), // Escape quotes
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Leads Management</h1>
            <p className="text-[var(--muted-foreground)] mt-2">Track and manage customer inquiries</p>
          </div>
          <button
            onClick={exportToCSV}
            disabled={leads.length === 0}
            className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export to CSV
          </button>
        </div>

        {/* Status Filter */}
        <div className="mb-6">
          <div className="flex gap-2">
            {['all', 'new', 'contacted', 'converted', 'closed'].map((status) => (
              <button
                key={status}
                onClick={() => {
                  setSelectedStatus(status);
                  setPage(1);
                }}
                className={`px-4 py-2 rounded-md font-medium capitalize ${
                  selectedStatus === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-[var(--surface)] text-[var(--muted-foreground)] hover:bg-[var(--background)]'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Leads Table */}
        <div className="bg-[var(--surface)] rounded-lg shadow-md overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-[var(--muted-foreground)]">Loading...</div>
          ) : leads.length === 0 ? (
            <div className="p-8 text-center text-[var(--muted-foreground)]">
              No {selectedStatus === 'all' ? '' : selectedStatus} leads found
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-[var(--background)] border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    Message
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-[var(--surface)] divide-y divide-gray-200">
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td className="px-6 py-4 text-sm text-[var(--muted-foreground)] whitespace-nowrap">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-[var(--foreground)]">{lead.name}</div>
                      <div className="text-sm text-[var(--muted-foreground)]">{lead.email}</div>
                      {lead.company && (
                        <div className="text-sm text-[var(--muted-foreground)]">{lead.company}</div>
                      )}
                      {lead.phone && (
                        <div className="text-sm text-[var(--muted-foreground)]">{lead.phone}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--foreground)]">
                      {lead.product.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--muted-foreground)] max-w-xs">
                      <div className="line-clamp-2">{lead.message}</div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={lead.status}
                        onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                        className={`px-2 py-1 text-xs font-medium rounded-md border ${
                          lead.status === 'new'
                            ? 'bg-yellow-50 text-yellow-800 border-yellow-200'
                            : lead.status === 'contacted'
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : lead.status === 'converted'
                            ? 'bg-green-50 text-green-800 border-green-200'
                            : 'bg-[var(--background)] text-[var(--foreground)] border-[var(--border)]'
                        }`}
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="converted">Converted</option>
                        <option value="closed">Closed</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex justify-center gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--background)]"
            >
              Previous
            </button>
            <span className="px-4 py-2">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--background)]"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
