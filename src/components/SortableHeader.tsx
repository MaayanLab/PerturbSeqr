import React from 'react';
import { FaSortUp } from 'react-icons/fa6';
import { IoMdInformationCircleOutline } from 'react-icons/io';

export function SortableHeader({
  sortKey,
  currentSort,
  setQueryString,
  children,
  tooltip,
  tooltipSide = 'left',
}: {
  sortKey: string;
  currentSort: string | null | undefined;
  setQueryString: (params: Record<string, string | null>) => void;
  children: React.ReactNode;
  tooltip?: React.ReactNode;
  tooltipSide?: 'left' | 'right';
}) {
  const active = currentSort === sortKey;
  const thClass = `relative group ${active ? 'bg-gray-400 text-gray-800' : ''}`;
  return (
    <th className={thClass}>
      {tooltip && (
        <div className={`absolute z-10 ${tooltipSide === 'right' ? 'right-0' : 'left-0'} top-10 mb-2 hidden w-max bg-gray-700 text-white text-xs rounded p-1 group-hover:block`}>
          {tooltip}
        </div>
      )}
      <span
        className="flex align-text-top cursor-pointer"
        onClick={() => setQueryString({ page: '1', sort: sortKey })}
      >
        {children} <FaSortUp />
        {tooltip && <IoMdInformationCircleOutline className="ml-0.5" />}
      </span>
    </th>
  );
}
