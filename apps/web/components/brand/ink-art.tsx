/** Original vector marks. Decorative instances are hidden from assistive technology. */
export function InkMark({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 64 64" className={className}>
      <path
        fill="currentColor"
        d="M49 10C38 2 21 5 11 16 0 29 5 47 18 55c13 8 31 4 39-8 8-12 5-28-5-36l-5 4c10 8 11 22 3 32-7 9-22 11-32 3C8 42 8 27 17 18c8-8 21-10 30-4l-3 3 9 1 1-10-5 2Z"
      />
      <path
        fill="currentColor"
        opacity=".45"
        d="M11 21C4 35 11 50 23 54l2-2C13 47 8 34 13 22l-2-1Z"
      />
      <circle cx="49" cy="47" r="5" fill="var(--seal, #b74436)" />
    </svg>
  );
}
export function Enso({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 240 240"
      fill="none"
      className={className}
    >
      <path
        fill="currentColor"
        d="M174 25C123-6 58 13 28 63-3 115 18 183 68 210c49 26 112 8 139-40 26-46 12-104-24-133l-12 10c37 30 42 80 17 116-25 36-75 47-113 22-38-25-49-76-23-115 25-37 73-51 110-29l-8 9 27-2-1-28-6 5Z"
      />
      <path
        stroke="currentColor"
        strokeWidth="2"
        opacity=".4"
        d="M167 18C112-5 45 20 21 75M29 150c17 57 91 86 143 54M197 61c21 29 21 73 4 102"
      />
      <path
        stroke="currentColor"
        strokeWidth="3"
        opacity=".55"
        d="M41 76C19 115 34 168 71 189M75 205c41 19 86 9 110-19"
      />
      <path
        stroke="currentColor"
        strokeWidth="1"
        opacity=".35"
        d="m38 58-9 14m-9 25-3 18m14 39 5 12m135 32 15-8"
      />
    </svg>
  );
}
export function InkLandscape({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 480 160" className={className}>
      <path
        fill="currentColor"
        opacity=".07"
        d="M0 153 85 103l31 18 69-84 39 49 30-15 103 68 56-19 67 37Z"
      />
      <path
        fill="currentColor"
        opacity=".13"
        d="m13 150 104-44 67-79 64 70 34-11 125 65-95-35-34-19-30 10-63-65-57 75Z"
      />
      <path fill="currentColor" opacity=".7" d="m97 118 88-95 53 64-52-49-37 42-37 34 19-28Z" />
      <path
        fill="currentColor"
        opacity=".25"
        d="m182 39 12 23 18 6-25-34Zm-20 39-13 30 29-25-9 3 6-14Z"
      />
      <path
        stroke="currentColor"
        strokeWidth="1.5"
        opacity=".2"
        d="m28 147 76-5 117 6 133-7 91 7"
      />
    </svg>
  );
}
