import axios, { AxiosRequestConfig } from "axios";

export type FetchPageResult<T> = {
  data: T[];
  totalPages?: number;
};

export type FetchPageFn<T> = (
  page: number,
  limit: number
) => Promise<FetchPageResult<T>>;

export interface PaginationHarvestAxiosParams extends AxiosRequestConfig {}

export interface PaginationHarvestOptions<T> {
  /** If provided, paginationHarvest will automatically use Axios to fetch each page. */
  axiosParams?: PaginationHarvestAxiosParams;
  /** If you want to use another library or custom logic, provide fetchPageFn. */
  fetchPageFn?: FetchPageFn<T>;
  startPage?: number;
  limit?: number;
  maxParallel?: number;
  maxRetries?: number;
  onProgress?: (fetchedPages: number, totalPages: number) => void;
}

export interface PaginationHarvestResult<T> {
  data: T[];
  failedPages: number[];
}

/**
 * High-performance paginated data harvester for APIs.
 * 
 * If using axiosParams, you can use Axios's transformResponse to shape the API response as { data: T[], totalPages }.
 * By default, it looks for an array under .data or .result and total pages under .totalPages or .maxPage.
 * 
 * For maximum flexibility, you can also provide a custom fetchPageFn for non-Axios or non-HTTP use cases.
 */
export async function paginationHarvest<T>({
  axiosParams,
  fetchPageFn,
  startPage = 1,
  limit = 500,
  maxParallel = 10,
  maxRetries = 2,
  onProgress,
}: PaginationHarvestOptions<T>): Promise<PaginationHarvestResult<T>> {
  // Helper for fetching a single page using Axios
  const axiosPageFetcher = async (page: number, lim: number): Promise<FetchPageResult<T>> => {
    if (!axiosParams) throw new Error("axiosParams not provided");
    const res = await axios({
      ...axiosParams,
      params: { ...(axiosParams.params || {}), page, limit: lim },
    });
    // If transformResponse is provided, the response should be shaped as { data, totalPages }
    // Otherwise, we fallback to default API response structure
    let result = res.data;
    if (typeof result !== "object" || result === null)
      throw new Error("Invalid response format");
    if (!Array.isArray(result.data) && !Array.isArray(result.result)) {
      throw new Error(
        "transformResponse required: result must have an array under .data or .result"
      );
    }
    const arr = Array.isArray(result.data) ? result.data : result.result;
    const totalPages =
      typeof result.totalPages === "number"
        ? result.totalPages
        : typeof result.maxPage === "number"
        ? result.maxPage
        : 1;
    return {
      data: arr,
      totalPages,
    };
  };

  // Determine which fetcher to use
  let activeFetcher: FetchPageFn<T>;
  if (axiosParams) {
    activeFetcher = axiosPageFetcher;
  } else if (fetchPageFn) {
    activeFetcher = fetchPageFn;
  } else {
    throw new Error("Either axiosParams or fetchPageFn must be provided");
  }

  // Step 1: Fetch first page
  const firstResult = await activeFetcher(startPage, limit);
  if (!firstResult || !Array.isArray(firstResult.data))
    throw new Error("First fetch did not return a valid data array");

  const totalPages = firstResult.totalPages || 1;
  const allResults: Array<T[] | undefined> = Array(totalPages);
  allResults[startPage - 1] = firstResult.data;
  let fetchedPages = 1;
  onProgress?.(fetchedPages, totalPages);

  if (totalPages === 1) {
    return { data: allResults.flat().filter(Boolean) as T[], failedPages: [] };
  }

  // Step 2: Prepare pages to fetch (excluding page 1)
  const pagesToFetch: number[] = [];
  for (let i = startPage + 1; i <= totalPages; ++i) pagesToFetch.push(i);

  // Step 3: Parallel queue worker
  async function parallelWorker(pages: number[]): Promise<number[]> {
    let failed: number[] = [];
    let pointer = 0;
    let running = 0;
    return new Promise<number[]>((resolve) => {
      function runNext() {
        if (pointer === pages.length && running === 0) return resolve(failed);
        while (running < maxParallel && pointer < pages.length) {
          const page = pages[pointer++];
          running++;
          activeFetcher(page, limit)
            .then((res) => {
              allResults[page - 1] = res.data;
              fetchedPages++;
              onProgress?.(fetchedPages, totalPages);
            })
            .catch(() => {
              failed.push(page);
            })
            .finally(() => {
              running--;
              runNext();
            });
        }
      }
      runNext();
    });
  }

  // Step 4: Fetch all pages + retry if needed
  let failedPages = await parallelWorker(pagesToFetch);

  for (let retry = 0; retry < maxRetries && failedPages.length > 0; ++retry) {
    const retryFailed = await parallelWorker(failedPages.slice());
    failedPages = retryFailed;
  }

  // Step 5: Return
  return {
    data: allResults.filter(Boolean).flat() as T[],
    failedPages,
  };
}