import { Disclosure } from "@headlessui/react";
import { Menu, X } from 'lucide-react';
import React, { useRef } from "react";

export type NavItem = {
  label: string;
  tooltip?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  isIconOnly?: boolean;
  // For file inputs: provide these instead of onClick
  fileAccept?: string;
  onFileChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  // For non-icon items (dropdowns, etc.)
  content?: React.ReactNode;
  disabled?: boolean;
};

type NavBarProps = {
  items: NavItem[];
};

function IconButton({ item }: { item: NavItem }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (item.fileAccept && fileRef.current) {
      fileRef.current.value = '';
      fileRef.current.click();
    } else if (item.onClick) {
      item.onClick();
    }
  };

  return (
    <div className="relative group">
      <button
        className="p-2 rounded-md hover:bg-gray-100 transition-colors text-gray-700 hover:text-gray-900 border border-gray-200 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
        title={item.tooltip || item.label}
        onClick={handleClick}
        disabled={item.disabled}
      >
        {item.icon}
      </button>
      <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        {item.tooltip || item.label}
      </div>
      {item.fileAccept && (
        <input
          ref={fileRef}
          type="file"
          accept={item.fileAccept}
          className="hidden"
          onChange={item.onFileChange}
        />
      )}
    </div>
  );
}

export function NavBar({ items }: NavBarProps) {
  const leftItems = items.filter(item => !item.isIconOnly);
  const rightItems = items.filter(item => item.isIconOnly);

  return (
    <Disclosure as="nav" className="border-b bg-white">
      {({ open }) => (
        <>
          <div className="mx-auto px-4">
            <div className="relative flex h-16 items-center justify-between gap-4">
              {/* Left side - dropdowns / controls */}
              <div className="hidden sm:flex items-center gap-3">
                {leftItems.map((item, i) => (
                  <div key={item.label || i}>
                    {item.content}
                  </div>
                ))}
              </div>

              {/* Right side - icon buttons */}
              <div className="hidden sm:flex items-center gap-1">
                {rightItems.map((item, i) => (
                  <IconButton key={item.label || i} item={item} />
                ))}
              </div>

              {/* Mobile menu button */}
              <div className="absolute inset-y-0 right-0 flex items-center sm:hidden">
                <Disclosure.Button className="inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-300 border">
                  <span className="sr-only">Open main menu</span>
                  {open ? <X size={16} /> : <Menu size={16} />}
                </Disclosure.Button>
              </div>
            </div>
          </div>

          {/* Mobile menu */}
          <Disclosure.Panel className="sm:hidden border-t bg-white z-10 w-full absolute">
            <div className="px-2 pt-2 pb-3 space-y-1 text-sm shadow-md bg-white">
              {items.map((item, i) => (
                <div key={item.label || i} className="py-2 border-b border-gray-100">
                  {item.content ? (
                    <div>
                      <span className="text-xs font-medium text-gray-500">{item.label}</span>
                      <div className="mt-1">{item.content}</div>
                    </div>
                  ) : (
                    <button
                      className="flex items-center gap-2 w-full px-2 py-1 rounded hover:bg-gray-100"
                      onClick={item.onClick}
                      disabled={item.disabled}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}
