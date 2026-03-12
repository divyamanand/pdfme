import { Disclosure } from "@headlessui/react";
import { Menu, X } from 'lucide-react';

export type NavItem = {
  label: string;
  content: React.ReactNode;
};

type NavBarProps = {
  items: NavItem[];
};

export function NavBar({ items }: NavBarProps) {
  return (
    <Disclosure as="nav" className="border-b bg-white shrink-0">
      {({ open }) => (
        <>
          <div className="px-2 py-1.5">
            <div className="relative flex items-center">
              {/* Desktop: horizontal flex row */}
              <div className="hidden sm:flex flex-wrap items-center gap-x-4 gap-y-1 w-full text-xs">
                {items.map(({ label, content }, index) => (
                  <div key={label || String(index)} className="flex items-center gap-1.5">
                    {label && (
                      <span className="font-medium text-gray-500 whitespace-nowrap">{label}</span>
                    )}
                    {content}
                  </div>
                ))}
              </div>

              {/* Mobile toggle */}
              <div className="ml-auto flex items-center sm:hidden">
                <Disclosure.Button className="inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-300 border">
                  <span className="sr-only">Open main menu</span>
                  {open ? (
                    <X className="block h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Menu className="block h-4 w-4" aria-hidden="true" />
                  )}
                </Disclosure.Button>
              </div>
            </div>
          </div>

          {/* Mobile panel */}
          <Disclosure.Panel className="sm:hidden border-t bg-white z-10 w-full absolute">
            <div className="px-2 pt-2 pb-3 space-y-2 text-sm shadow-md rounded-md bg-white">
              {items.map(({ label, content }, index) => (
                <div key={label || String(index)} className="flex flex-col border-b border-gray-200 py-2">
                  {label && <span className="block mb-1 text-xs font-medium text-gray-500">{label}</span>}
                  {content}
                </div>
              ))}
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}
