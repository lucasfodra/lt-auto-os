import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  AppDatabaseState,
  Customer,
  FlipCarProject,
  Language,
  PaymentMethod,
  ServiceCatalogItem,
  TechnicalChecklist,
  Vehicle,
  WorkOrder,
  WorkOrderStatus,
  WorkshopSettings,
} from '../types/domain';
import { repository } from '../services/repository';

interface AppContextValue {
  db: AppDatabaseState;
  uiLang: Language;
  setUiLang: (lang: Language) => void;
  docLang: Language;
  setDocLang: (lang: Language) => void;
  activeCheckoutOrderId: string | null;
  setActiveCheckoutOrderId: (id: string | null) => void;
  addWorkOrder: (order: Omit<WorkOrder, 'id' | 'orderNumber' | 'createdAt'>) => WorkOrder;
  updateWorkOrderStatus: (id: string, status: WorkOrderStatus) => void;
  updateWorkOrderSchedule: (
    id: string,
    scheduledDate: string,
    dropOffSlot: string,
    promisedReadyTime: string
  ) => void;
  toggleWorkOrderTimer: (id: string) => void;
  adjustWorkOrderSeconds: (id: string, totalSeconds: number) => void;
  updateWorkOrderChecklist: (id: string, key: keyof TechnicalChecklist, value: boolean) => void;
  updateWorkOrderDiagnostics: (
    id: string,
    dtcFaults: string[],
    advisoryNotes: string,
    oilSpecUsed?: string
  ) => void;
  markOrderPaid: (id: string, method: PaymentMethod) => void;
  upsertCustomerAndVehicle: (customer: Customer, vehicle: Vehicle) => void;
  updateServiceCatalogItem: (item: ServiceCatalogItem) => void;
  addFlipCar: (flip: Omit<FlipCarProject, 'id'>) => void;
  updateFlipCar: (flip: FlipCarProject) => void;
  updateSettings: (settings: Partial<WorkshopSettings>) => void;
  resetDemoData: () => void;
  triggerCloudSync: () => Promise<{ ok: boolean; message: string }>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [db, setDb] = useState<AppDatabaseState>(() => repository.loadState());
  const [uiLang, setUiLang] = useState<Language>('PT-BR');
  const [docLang, setDocLang] = useState<Language>('EN-GB');
  const [activeCheckoutOrderId, setActiveCheckoutOrderId] = useState<string | null>(null);

  useEffect(() => {
    repository.saveState(db);
  }, [db]);

  useEffect(() => {
    const hasRunning = db.workOrders.some((wo) => wo.timerRunning);
    if (!hasRunning) return;

    const interval = setInterval(() => {
      setDb((prev) => ({
        ...prev,
        workOrders: prev.workOrders.map((wo) =>
          wo.timerRunning
            ? { ...wo, actualSecondsSpent: wo.actualSecondsSpent + 1 }
            : wo
        ),
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [db.workOrders]);

  const addWorkOrder = (
    orderInput: Omit<WorkOrder, 'id' | 'orderNumber' | 'createdAt'>
  ): WorkOrder => {
    const nextNum = 101 + db.workOrders.length;
    const newOrder: WorkOrder = {
      ...orderInput,
      id: `wo-${Date.now()}`,
      orderNumber: `LT-2026-${nextNum}`,
      createdAt: new Date().toISOString(),
    };
    setDb((prev) => ({
      ...prev,
      workOrders: [newOrder, ...prev.workOrders],
    }));
    return newOrder;
  };

  const updateWorkOrderStatus = (id: string, status: WorkOrderStatus) => {
    setDb((prev) => ({
      ...prev,
      workOrders: prev.workOrders.map((wo) => {
        if (wo.id !== id) return wo;
        const completedAt =
          status === 'Completed' || status === 'Paid'
            ? wo.completedAt || new Date().toISOString()
            : wo.completedAt;
        return {
          ...wo,
          status,
          timerRunning: status === 'InProgress' ? wo.timerRunning : false,
          completedAt,
        };
      }),
    }));
  };

  const updateWorkOrderSchedule = (
    id: string,
    scheduledDate: string,
    dropOffSlot: string,
    promisedReadyTime: string
  ) => {
    setDb((prev) => ({
      ...prev,
      workOrders: prev.workOrders.map((wo) =>
        wo.id === id
          ? {
              ...wo,
              scheduledDate,
              dropOffSlot,
              promisedReadyTime,
            }
          : wo
      ),
    }));
  };

  const toggleWorkOrderTimer = (id: string) => {
    setDb((prev) => ({
      ...prev,
      workOrders: prev.workOrders.map((wo) => {
        if (wo.id !== id) return wo;
        const nextRunning = !wo.timerRunning;
        return {
          ...wo,
          status: nextRunning && wo.status === 'Booked' ? 'InProgress' : wo.status,
          timerRunning: nextRunning,
          timerLastStartedAt: nextRunning ? Date.now() : undefined,
        };
      }),
    }));
  };

  const adjustWorkOrderSeconds = (id: string, totalSeconds: number) => {
    setDb((prev) => ({
      ...prev,
      workOrders: prev.workOrders.map((wo) =>
        wo.id === id ? { ...wo, actualSecondsSpent: Math.max(0, totalSeconds) } : wo
      ),
    }));
  };

  const updateWorkOrderChecklist = (
    id: string,
    key: keyof TechnicalChecklist,
    value: boolean
  ) => {
    setDb((prev) => ({
      ...prev,
      workOrders: prev.workOrders.map((wo) =>
        wo.id === id
          ? { ...wo, checklist: { ...wo.checklist, [key]: value } }
          : wo
      ),
    }));
  };

  const updateWorkOrderDiagnostics = (
    id: string,
    dtcFaults: string[],
    advisoryNotes: string,
    oilSpecUsed?: string
  ) => {
    setDb((prev) => ({
      ...prev,
      workOrders: prev.workOrders.map((wo) =>
        wo.id === id
          ? {
              ...wo,
              dtcFaults,
              advisoryNotes,
              oilSpecUsed: oilSpecUsed ?? wo.oilSpecUsed,
            }
          : wo
      ),
    }));
  };

  const markOrderPaid = (id: string, method: PaymentMethod) => {
    setDb((prev) => ({
      ...prev,
      workOrders: prev.workOrders.map((wo) =>
        wo.id === id
          ? {
              ...wo,
              status: 'Paid',
              timerRunning: false,
              completedAt: wo.completedAt || new Date().toISOString(),
              paymentMethod: method,
            }
          : wo
      ),
    }));
  };

  const upsertCustomerAndVehicle = (customer: Customer, vehicle: Vehicle) => {
    setDb((prev) => {
      const custExists = prev.customers.some((c) => c.id === customer.id);
      const vehExists = prev.vehicles.some((v) => v.id === vehicle.id);
      return {
        ...prev,
        customers: custExists
          ? prev.customers.map((c) => (c.id === customer.id ? customer : c))
          : [customer, ...prev.customers],
        vehicles: vehExists
          ? prev.vehicles.map((v) => (v.id === vehicle.id ? vehicle : v))
          : [vehicle, ...prev.vehicles],
      };
    });
  };

  const updateServiceCatalogItem = (item: ServiceCatalogItem) => {
    setDb((prev) => ({
      ...prev,
      serviceCatalog: prev.serviceCatalog.map((s) => (s.id === item.id ? item : s)),
    }));
  };

  const addFlipCar = (flip: Omit<FlipCarProject, 'id'>) => {
    setDb((prev) => ({
      ...prev,
      flipCars: [{ ...flip, id: `flip-${Date.now()}` }, ...prev.flipCars],
    }));
  };

  const updateFlipCar = (flip: FlipCarProject) => {
    setDb((prev) => ({
      ...prev,
      flipCars: prev.flipCars.map((f) => (f.id === flip.id ? flip : f)),
    }));
  };

  const updateSettings = (settings: Partial<WorkshopSettings>) => {
    setDb((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...settings },
    }));
  };

  const resetDemoData = () => {
    const fresh = repository.resetToSeedData();
    setDb(fresh);
  };

  const triggerCloudSync = async () => {
    return repository.syncWithSupabase(db);
  };

  return (
    <AppContext.Provider
      value={{
        db,
        uiLang,
        setUiLang,
        docLang,
        setDocLang,
        activeCheckoutOrderId,
        setActiveCheckoutOrderId,
        addWorkOrder,
        updateWorkOrderStatus,
        updateWorkOrderSchedule,
        toggleWorkOrderTimer,
        adjustWorkOrderSeconds,
        updateWorkOrderChecklist,
        updateWorkOrderDiagnostics,
        markOrderPaid,
        upsertCustomerAndVehicle,
        updateServiceCatalogItem,
        addFlipCar,
        updateFlipCar,
        updateSettings,
        resetDemoData,
        triggerCloudSync,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
