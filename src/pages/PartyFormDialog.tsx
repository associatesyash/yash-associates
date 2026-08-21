import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { saveParty } from '@/services/partyService';
import { toast } from 'sonner';
import type { Party } from '@/types';

interface PartyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  party: Party | null;
  onSaved: () => void;
}

export function PartyFormDialog({ open, onOpenChange, party, onSaved }: PartyFormDialogProps) {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [creditLimit, setCreditLimit] = useState('0');
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (party) {
      setName(party.name);
      setMobile(party.mobile);
      setAddress(party.address);
      setCity(party.city);
      setOpeningBalance(String(party.openingBalance));
      setCreditLimit(String(party.creditLimit));
      setNotes(party.notes);
      setActive(party.active);
    } else {
      setName('');
      setMobile('');
      setAddress('');
      setCity('');
      setOpeningBalance('0');
      setCreditLimit('0');
      setNotes('');
      setActive(true);
    }
    setErrors({});
  }, [party, open]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Party name is required';
    if (mobile && !/^\d{10}$/.test(mobile)) errs.mobile = 'Mobile must be 10 digits';
    if (isNaN(Number(openingBalance))) errs.openingBalance = 'Invalid amount';
    if (isNaN(Number(creditLimit))) errs.creditLimit = 'Invalid amount';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await saveParty({
        id: party?.id,
        name: name.trim(),
        mobile: mobile.trim(),
        address: address.trim(),
        city: city.trim(),
        openingBalance: Number(openingBalance) || 0,
        creditLimit: Number(creditLimit) || 0,
        notes: notes.trim(),
        active,
      });
      toast.success(party ? 'Party updated' : 'Party created');
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save party');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{party ? 'Edit Party' : 'New Party'}</DialogTitle>
          <DialogDescription>Enter customer contact and credit details.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="name">Party Name <span className="text-destructive">*</span></Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ABC Garments" />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="mobile">Mobile</Label>
              <Input id="mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="10 digit number" maxLength={10} />
              {errors.mobile && <p className="text-xs text-destructive">{errors.mobile}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Surat" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="Full address" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="openingBalance">Opening Due (₹)</Label>
              <Input id="openingBalance" type="number" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
              {errors.openingBalance && <p className="text-xs text-destructive">{errors.openingBalance}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="creditLimit">Credit Limit (₹)</Label>
              <Input id="creditLimit" type="number" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} />
              {errors.creditLimit && <p className="text-xs text-destructive">{errors.creditLimit}</p>}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Additional notes" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} id="active" />
            <Label htmlFor="active">Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
