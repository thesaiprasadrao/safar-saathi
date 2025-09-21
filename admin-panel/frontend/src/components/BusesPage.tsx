import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Save, X, Check, Plus } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { BusesAPI, RoutesAPI } from '../lib/api';
import { store } from '../lib/store';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';

interface Bus {
  id: string;
  plateNumber: string;
  model: string;
  capacity: number;
  status: string; 
  assignedRoute: string | null;
  driver: string | null;
  fuelLevel: number;
  lastMaintenance: string;
  mileage: number;
}


const initialBuses: Bus[] = [];

export function BusesPage() {
  const [buses, setBuses] = useState<Bus[]>(() => (store.buses || initialBuses) as Bus[]);
  const [routesOptions, setRoutesOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(!store.buses);
  useEffect(() => {
    Promise.all([
      BusesAPI.list().then((list) =>
        setBuses((store.buses = (list as any)).map((b: any) => ({
            ...b,
            status: String(b.status || ''),
            assignedRoute: b.assignedRoute ?? null,
          })) as Bus[])
      ),
      RoutesAPI.list().then((rs) => setRoutesOptions(rs.map(r => r.routeId)))
    ]).finally(() => setLoading(false));
  }, []);
  const [editingRows, setEditingRows] = useState<Set<string>>(new Set());
  const [tempValues, setTempValues] = useState<Record<string, Partial<Bus>>>({});
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [showAddBus, setShowAddBus] = useState(false);
  const [newBusNumber, setNewBusNumber] = useState('');
  const [newBusRoute, setNewBusRoute] = useState<string | 'none'>('none');

  const handleEditRow = (busId: string) => {
    const bus = buses.find(b => b.id === busId);
    if (bus) {
      setTempValues({ ...tempValues, [busId]: { ...bus } });
      setEditingRows(prev => new Set([...prev, busId]));
    }
  };

  const handleSaveRow = async (busId: string) => {
    const updatedBus = tempValues[busId];
    if (updatedBus) {
      try {
        setSavingRowId(busId);
        await BusesAPI.update(busId, {
          assignedRoute: updatedBus.assignedRoute ?? null,
        });
  const next = buses.map(bus => bus.id === busId ? { ...bus, ...updatedBus } : bus)
  setBuses(next);
  if (store.buses) store.buses = next as any
        toast.success(`Bus ${busId} updated`);
      } catch (e: any) {
        toast.error(e?.message || 'Failed to update bus');
        return; 
      } finally {
        setSavingRowId(null);
      }
    }
    setEditingRows(prev => {
      const newSet = new Set(prev);
      newSet.delete(busId);
      return newSet;
    });
    setTempValues(prev => {
      const newValues = { ...prev };
      delete newValues[busId];
      return newValues;
    });
  };

  const handleCancelRow = (busId: string) => {
    setEditingRows(prev => {
      const newSet = new Set(prev);
      newSet.delete(busId);
      return newSet;
    });
    setTempValues(prev => {
      const newValues = { ...prev };
      delete newValues[busId];
      return newValues;
    });
    toast.info(`Changes to ${busId} discarded`);
  };

  const handleUpdateTempValue = (busId: string, field: keyof Bus, value: any) => {
    setTempValues(prev => ({
      ...prev,
      [busId]: {
        ...prev[busId],
        [field]: value
      }
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {}
      <div>
        <h2 className="text-3xl font-bold text-gradient-primary tracking-tight">Buses</h2>
        <p className="text-lg text-muted-foreground">
          Manage bus assignments and status
        </p>
      </div>

      {}
      <Card className="card-elevated border-0">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-gradient-primary">Bus Fleet</CardTitle>
            <CardDescription>Assign routes and update bus status</CardDescription>
          </div>
          <Dialog open={showAddBus} onOpenChange={setShowAddBus}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Bus
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Bus</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <label className="text-sm font-medium">Bus Number</label>
                  <Input value={newBusNumber} onChange={e => setNewBusNumber(e.target.value)} placeholder="e.g. BUS-101" />
                </div>
                <div>
                  <label className="text-sm font-medium">Assign Route (optional)</label>
                  <Select
                    value={newBusRoute}
                    onValueChange={(v) => setNewBusRoute(v as any)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select route" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {routesOptions.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={async () => {
                    const busNumber = newBusNumber.trim()
                    if (!busNumber) { toast.error('Bus number is required'); return }
                    try {
                      const created = await BusesAPI.create({ busNumber, assignedRoute: newBusRoute === 'none' ? null : newBusRoute })
                      const next = [...buses, created as any]
                      setBuses(next)
                      store.buses = next as any
                      toast.success(`Bus ${busNumber} created`)
                      setShowAddBus(false)
                      setNewBusNumber('')
                      setNewBusRoute('none')
                    } catch (e: any) {
                      toast.error(e?.message || 'Failed to create bus')
                    }
                  }}
                >
                  Create Bus
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading buses…</div>
          ) : buses.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bus ID</TableHead>
                  <TableHead>Route ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buses.map((bus) => {
                const isEditing = editingRows.has(bus.id);
                const tempBus = tempValues[bus.id] || bus;

                return (
                  <TableRow key={bus.id}>
                    <TableCell className="font-medium">{bus.plateNumber}</TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Select
                          value={tempBus.assignedRoute || 'none'}
                          onValueChange={(value) => 
                            handleUpdateTempValue(bus.id, 'assignedRoute', value === 'none' ? null : value)
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                          {routesOptions.map((route) => (
                              <SelectItem key={route} value={route}>
                                {route}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span>{bus.assignedRoute || <span className="text-muted-foreground">None</span>}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor((bus.status as any)?.toString().toLowerCase())}>
                        {((bus.status as any)?.toString() || '').charAt(0).toUpperCase() + ((bus.status as any)?.toString() || '').slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSaveRow(bus.id)}
                            disabled={savingRowId === bus.id}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            {savingRowId === bus.id ? 'Saving…' : 'Save'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelRow(bus.id)}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditRow(bus.id)}
                        >
                          <Save className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No buses found.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}