import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const utcDate = (d) => { if (!d) return new Date(); const s = String(d); return new Date(s.endsWith('Z') ? s : s + 'Z'); };

const AdminDepositsTab = () => {
  const [deposits, setDeposits] = useState([]);

  const fetchDeposits = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/admin/deposits`, { withCredentials: true });
      setDeposits(data.deposits);
    } catch (error) {}
  }, []);

  useEffect(() => {
    fetchDeposits();
    const interval = setInterval(fetchDeposits, 10000);
    return () => clearInterval(interval);
  }, [fetchDeposits]);

  return (
    <Card className="bg-gray-50 border-gray-200">
      <CardHeader>
        <CardTitle className="text-gray-900 font-['Unbounded']">जमा सूची</CardTitle>
        <CardDescription className="text-gray-500">सभी सफल जमा की सूची</CardDescription>
      </CardHeader>
      <CardContent>
        {deposits.length === 0 ? (
          <div className="text-center py-8"><p className="text-gray-500">कोई जमा नहीं मिला</p></div>
        ) : (
          <div className="space-y-3">
            {deposits.map((d, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                <div>
                  <p className="text-gray-900 font-medium text-sm">{d.user_name || 'User'}</p>
                  <p className="text-gray-500 text-xs">{d.user_phone || d.user_email || ''}</p>
                  <p className="text-gray-500 text-xs">
                    {d.created_at ? utcDate(d.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-emerald-400">₹{d.amount}</p>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs">सफल</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminDepositsTab;
