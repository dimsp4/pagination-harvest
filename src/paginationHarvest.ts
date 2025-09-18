export type FetchPageResult<T> = {
  data: T[];
  totalPages?: number;
};

export type FetchPageFn<T> = (
  page: number,
  limit: number
) => Promise<FetchPageResult<T>>;

export interface PaginationHarvestOptions<T> {
  /**
   * Your custom page fetching function.
   * It must return an object: { data: T[]; totalPages?: number }
   * Mandatory.
   */
  fetchPageFn: FetchPageFn<T>;
  /**
   * The page to start fetching from. Default: 1
   */
  startPage?: number;
  /**
   * Items per page. Default: 500
   */
  limit?: number;
  /**
   * Maximum concurrent page fetches. Default: 10
   */
  maxParallel?: number;
  /**
   * Maximum retry attempts for failed pages. Default: 2
   */
  maxRetries?: number;
  /**
   * Callback for progress reporting: (fetchedPages, totalPages) => void
   */
  onProgress?: (fetchedPages: number, totalPages: number) => void;
}

export interface PaginationHarvestResult<T> {
  data: T[];
  failedPages: number[];
}

/**
 * High-performance paginated data harvester for any API.
 * 
 * You must provide a fetchPageFn that returns { data: T[], totalPages?: number }.
 * This function will automatically gather all pages, in parallel, with retry and progress support.
 */
const paginationHarvest = async <T>({
  fetchPageFn,
  startPage = 1,
  limit = 500,
  maxParallel = 10,
  maxRetries = 2,
  onProgress,
}: PaginationHarvestOptions<T>): Promise<PaginationHarvestResult<T>> => {
  if (typeof fetchPageFn !== "function")
    throw new Error("fetchPageFn is required and must be a function");

  // Step 1: Fetch first page to get totalPages & initial data
  const firstResult = await fetchPageFn(startPage, limit);
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

  // Step 2: Prepare pages to fetch (excluding the first page)
  const pagesToFetch: number[] = [];
  for (let i = startPage + 1; i <= totalPages; ++i) pagesToFetch.push(i);

  // Step 3: Parallel worker for fetching pages
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
          fetchPageFn(page, limit)
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

  // Step 4: Fetch all pages and retry failed ones
  let failedPages = await parallelWorker(pagesToFetch);

  for (let retry = 0; retry < maxRetries && failedPages.length > 0; ++retry) {
    const retryFailed = await parallelWorker(failedPages.slice());
    failedPages = retryFailed;
  }

  // Step 5: Return all results
  return {
    data: allResults.filter(Boolean).flat() as T[],
    failedPages,
  };
}

export default paginationHarvest;