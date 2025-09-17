# pagination-harvest

A blazing fast, parallelized data harvester for paginated APIs.  
**pagination-harvest** helps you gather all data from APIs that return paginated results, with automatic parallel fetching, retries, and progress callbacks.  
It supports both [Axios](https://axios-http.com/) and custom fetchers—making it flexible for any backend or frontend project.

---

## 🚀 Features

- Fetch all pages from paginated APIs automatically
- Ultra-fast: fetches multiple pages in parallel
- Retry mechanism for failed pages
- Progress callback for UI feedback
- Works out of the box with Axios or custom fetch logic
- Written in TypeScript, fully typed

---

## 🔌 Axios Support

If your API uses a standard paginated response, you can use `axiosParams` and let pagination-harvest do the rest.  
For custom API shapes, simply use Axios's [`transformResponse`](https://axios-http.com/docs/req_config#transformresponse) to map your response to the expected structure.

---

## 📦 Installation

```bash
npm install pagination-harvest axios
# or
yarn add pagination-harvest axios
```

---

## 🛠️ Usage Example

### 1. Using Axios with Default Response

If your API returns:
```json
{
  "data": [ ... ],
  "totalPages": 12
}
```
You can use:

```typescript
import { paginationHarvest } from "pagination-harvest";

const { data, failedPages } = await paginationHarvest({
  axiosParams: {
    method: "GET",
    url: "https://api.example.com/v1/items",
    headers: { Authorization: "Bearer token" }
    // No transformResponse needed if your API uses 'data' and 'totalPages'
  },
  limit: 100,
  maxParallel: 8,
  onProgress: (progress, total) => {
    console.log(`Downloaded ${progress} / ${total} pages`);
  }
});

console.log(data); // all items from all pages
```

---

### 2. Using Axios with Custom Response (transformResponse)

If your API returns:
```json
{
  "result": [ ... ],
  "maxPage": 7
}
```
You can use:

```typescript
import { paginationHarvest } from "pagination-harvest";

const { data } = await paginationHarvest({
  axiosParams: {
    method: "GET",
    url: "https://api.example.com/v1/items",
    transformResponse: [(raw) => {
      const json = JSON.parse(raw);
      return {
        data: json.result,        // array of data
        totalPages: json.maxPage  // total number of pages
      };
    }]
  },
  limit: 50
});
```

---

### 3. Using a Custom Fetch Function

You can use your own fetch logic (axios, fetch, any library):

```typescript
import { paginationHarvest } from "pagination-harvest";
import axios from "axios";

const fetchPageFn = async (page, limit) => {
  const res = await axios.get("/api/custom", { params: { page, limit } });
  return {
    data: res.data.items,
    totalPages: res.data.pageCount
  };
};

const { data } = await paginationHarvest({
  fetchPageFn,
  limit: 100
});
```

---

## 🔖 Props Reference

| Prop             | Type                         | Required | Default   | Description                                                                                 |
|------------------|-----------------------------|----------|-----------|---------------------------------------------------------------------------------------------|
| **axiosParams**  | `AxiosRequestConfig`         | No       | -         | Axios parameters for automatic fetching. If provided, fetchPageFn is ignored.               |
| **fetchPageFn**  | `(page, limit) => Promise<{ data: T[]; totalPages?: number }>` | No | - | Custom page fetcher. Required if axiosParams is not used.                                   |
| **startPage**    | `number`                     | No       | `1`       | The starting page number.                                                                   |
| **limit**        | `number`                     | No       | `500`     | Number of items per page.                                                                   |
| **maxParallel**  | `number`                     | No       | `10`      | Maximum number of concurrent page fetches.                                                  |
| **maxRetries**   | `number`                     | No       | `2`       | Number of retry attempts for failed pages.                                                  |
| **onProgress**   | `(fetchedPages, totalPages) => void` | No | -  | Callback invoked every time a page is fetched.                                              |

**At least one of `axiosParams` or `fetchPageFn` is required.**  
If both are provided, `axiosParams` takes precedence.

### ⚡️ Response

The function resolves to:
```typescript
type PaginationHarvestResult<T> = {
  data: T[];         // All data items from all pages
  failedPages: number[]; // Array of pages that failed to fetch after retries
}
```

---

## 🧑‍💻 License

MIT

---