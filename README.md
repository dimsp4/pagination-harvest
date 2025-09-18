# pagination-harvest

A blazing fast, parallelized data harvester for paginated APIs.  
**pagination-harvest** helps you gather all data from APIs that return paginated results, with automatic parallel fetching, retries, and progress callbacks.  
It supports any custom fetcher (Axios, fetch API, etc.) making it highly flexible for any backend, frontend, or custom API architecture. 

---

## 🚀 Features

- Fetch all pages from paginated APIs automatically
- Ultra-fast: fetches multiple pages in parallel
- Retry mechanism for failed pages
- Progress callback for UI feedback
- Works out of the box with any custom fetch logic
- Written in TypeScript, fully typed

---

## 📦 Installation

```bash
npm install pagination-harvest
# or
yarn add pagination-harvest
```

---

## 🛠️ Usage Example

### Custom Fetch Function

You can use your own fetch logic (axios, fetch, any library):

```typescript
import paginationHarvest from "pagination-harvest";

const fetchPageFn = async (page: number, limit: number) => {
  const res = await fetch("/api/items", {
    method: "GET",
    headers: { Authorization: "Bearer your-jwt-token" },
    params: { page, limit }
  });

  const json = await res.json();

  return {
    data: json.items,           // Array of items from this page
    totalPages: json.totalPages // Total number of pages (optional, but useful)
  };
};

const { data, failedPages } = await paginationHarvest({
  fetchPageFn,
  limit: 100,
  maxParallel: 8,
  maxRetries: 3,
  onProgress: (fetched, total) => {
    console.log(`📥 Downloaded ${fetched} / ${total} pages`);
  },
  startPage: 1
});

console.log("All data collected:", data);
console.log("Failed pages (after retries):", failedPages);

```

---

## 🔖 Props Reference

| Prop             | Type                         | Required | Default   | Description                                                                                 |
|------------------|-----------------------------|----------|-----------|---------------------------------------------------------------------------------------------|
| **fetchPageFn**  | `(page, limit) => Promise<{ data: T[]; totalPages?: number }>` | Yes | - | Custom page fetcher.                                  |
| **startPage**    | `number`                     | No       | `1`       | The starting page number.                                                                   |
| **limit**        | `number`                     | No       | `500`     | Number of items per page.                                                                   |
| **maxParallel**  | `number`                     | No       | `10`      | Maximum number of concurrent page fetches.                                                  |
| **maxRetries**   | `number`                     | No       | `2`       | Number of retry attempts for failed pages.                                                  |
| **onProgress**   | `(fetchedPages, totalPages) => void` | No | -  | Callback invoked every time a page is fetched.                                              |

### ⚡️ Response

The function resolves to:
```typescript
type PaginationHarvestResult<T> = {
  data: T[];         // All data items from all pages
  failedPages: number[]; // Array of pages that failed to fetch after retries
}
```
Let’s harvest data—fast, smart, and yours. 🌱

---

## 🧑‍💻 License

MIT

---