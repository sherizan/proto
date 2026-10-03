import React, { createContext, useContext, useState, type ReactNode } from 'react';
import { mock } from '../proto';

export const drinks = mock([
  { id: 'latte', name: 'Oat Latte', note: 'Silky espresso. Naturally sweet oats.', price: 5.5, image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=900&auto=format&fit=crop' },
  { id: 'flat-white', name: 'Flat White', note: 'Double espresso, velvety microfoam.', price: 4.5, image: 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?w=700&auto=format&fit=crop' },
  { id: 'cold-brew', name: 'Cold Brew', note: 'Slow steeped. Smooth and refreshing.', price: 5, image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=700&auto=format&fit=crop' },
  { id: 'cappuccino', name: 'Cappuccino', note: 'Rich espresso with a cloud of foam.', price: 4.8, image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=700&auto=format&fit=crop' }
]);

export type CoffeeOrder = {
  name: string;
  size: string;
  temperature: string;
  milk: string;
  shots: number;
  quantity: number;
  total: number;
};

type State = {
  cart: CoffeeOrder | null;
  setCart: (value: CoffeeOrder | null) => void;
  orders: CoffeeOrder[];
  place: () => void;
};

const CoffeeContext = createContext<State>({ cart: null, setCart: () => {}, orders: [], place: () => {} });

export function CoffeeProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CoffeeOrder | null>(null);
  const [orders, setOrders] = useState<CoffeeOrder[]>([]);
  return (
    <CoffeeContext.Provider value={{
      cart,
      setCart,
      orders,
      place: () => {
        if (cart) {
          setOrders((current) => [cart, ...current]);
          setCart(null);
        }
      }
    }}>
      {children}
    </CoffeeContext.Provider>
  );
}

export const useCoffee = () => useContext(CoffeeContext);
export const money = (value: number) => '$' + value.toFixed(2);
