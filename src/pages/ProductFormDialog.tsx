import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { saveProduct } from '@/services/productService';
import { getCategories, getBrands, addCategory, addBrand, DEFAULT_SIZES, DEFAULT_COLORS } from '@/services/settingsService';
import { toast } from 'sonner';
import type { Product } from '@/types';

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onSaved: () => void;
}

export function ProductFormDialog({ open, onOpenChange, product, onSaved }: ProductFormDialogProps) {
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [design, setDesign] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [unit, setUnit] = useState('Piece');
  const [purchaseRate, setPurchaseRate] = useState('0');
  const [wholesaleRate, setWholesaleRate] = useState('0');
  const [mrp, setMrp] = useState('0');
  const [openingStock, setOpeningStock] = useState('0');
  const [minStock, setMinStock] = useState('0');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);

  const loadMeta = async () => {
    const cats = await getCategories('product');
    const brs = await getBrands();
    setCategories(cats);
    setBrands(brs);
  };

  const handleOpen = async () => {
    await loadMeta();
    if (product) {
      setCode(product.code);
      setCategory(product.category);
      setBrand(product.brand);
      setDesign(product.design);
      setSize(product.size);
      setColor(product.color);
      setUnit(product.unit);
      setPurchaseRate(String(product.purchaseRate));
      setWholesaleRate(String(product.wholesaleRate));
      setMrp(String(product.mrp));
      setOpeningStock(String(product.openingStock));
      setMinStock(String(product.minStock));
      setDescription(product.description);
      setActive(product.active);
    } else {
      setCode(''); setCategory(''); setBrand(''); setDesign(''); setSize(''); setColor(''); setUnit('Piece');
      setPurchaseRate('0'); setWholesaleRate('0'); setMrp('0'); setOpeningStock('0'); setMinStock('0'); setDescription(''); setActive(true);
    }
    setErrors({});
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!code.trim()) errs.code = 'Product code is required';
    if (!category) errs.category = 'Category is required';
    if (!brand) errs.brand = 'Brand is required';
    if (!design.trim()) errs.design = 'Design is required';
    if (isNaN(Number(purchaseRate)) || Number(purchaseRate) < 0) errs.purchaseRate = 'Invalid rate';
    if (isNaN(Number(wholesaleRate)) || Number(wholesaleRate) < 0) errs.wholesaleRate = 'Invalid rate';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await saveProduct({
        id: product?.id,
        code: code.trim(),
        category,
        brand,
        design: design.trim(),
        size,
        color,
        unit,
        purchaseRate: Number(purchaseRate) || 0,
        wholesaleRate: Number(wholesaleRate) || 0,
        mrp: Number(mrp) || 0,
        openingStock: Number(openingStock) || 0,
        minStock: Number(minStock) || 0,
        description: description.trim(),
        active,
      });
      toast.success(product ? 'Product updated' : 'Product created');
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (v) handleOpen(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit Product' : 'New Product'}</DialogTitle>
          <DialogDescription>Enter the product variant and pricing details.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Product Code <span className="text-destructive">*</span></Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. BRA-001" />
              {errors.code && <p className="text-xs text-destructive">{errors.code}</p>}
            </div>
            <div className="grid gap-2">
              <Label>Category <span className="text-destructive">*</span></Label>
              <Select value={category} onValueChange={async (v) => { setCategory(v); }}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Brand <span className="text-destructive">*</span></Label>
              <Select value={brand} onValueChange={setBrand}>
                <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
                <SelectContent>
                  {brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.brand && <p className="text-xs text-destructive">{errors.brand}</p>}
            </div>
            <div className="grid gap-2">
              <Label>Design / Model <span className="text-destructive">*</span></Label>
              <Input value={design} onChange={(e) => setDesign(e.target.value)} placeholder="e.g. 105" />
              {errors.design && <p className="text-xs text-destructive">{errors.design}</p>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>Size</Label>
              <Select value={size} onValueChange={setSize}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {DEFAULT_SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Color</Label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {DEFAULT_COLORS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Piece">Piece</SelectItem>
                  <SelectItem value="Dozen">Dozen</SelectItem>
                  <SelectItem value="Box">Box</SelectItem>
                  <SelectItem value="Set">Set</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>Purchase Rate (₹)</Label>
              <Input type="number" value={purchaseRate} onChange={(e) => setPurchaseRate(e.target.value)} />
              {errors.purchaseRate && <p className="text-xs text-destructive">{errors.purchaseRate}</p>}
            </div>
            <div className="grid gap-2">
              <Label>Wholesale Rate (₹)</Label>
              <Input type="number" value={wholesaleRate} onChange={(e) => setWholesaleRate(e.target.value)} />
              {errors.wholesaleRate && <p className="text-xs text-destructive">{errors.wholesaleRate}</p>}
            </div>
            <div className="grid gap-2">
              <Label>MRP (₹)</Label>
              <Input type="number" value={mrp} onChange={(e) => setMrp(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Opening Stock</Label>
              <Input type="number" value={openingStock} onChange={(e) => setOpeningStock(e.target.value)} disabled={!!product} />
              {product && <p className="text-xs text-muted-foreground">Use stock adjustment for existing products</p>}
            </div>
            <div className="grid gap-2">
              <Label>Minimum Stock</Label>
              <Input type="number" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} id="pactive" />
            <Label htmlFor="pactive">Active</Label>
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
