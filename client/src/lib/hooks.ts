import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { api, khoa } from '../api';
import type { BuoiDayDu, LopChiTiet, SuaBuoi } from '../api/types';
import { tinhLop } from './nghiepVu';

export const useDsTruong = () => useQuery({ queryKey: khoa.truong, queryFn: api.truong.ds });
export const useDsDiaDiem = () => useQuery({ queryKey: khoa.diaDiem, queryFn: api.diaDiem.ds });
export const useDsKyHoc = () => useQuery({ queryKey: khoa.kyHoc, queryFn: api.kyHoc.ds });
export const useDsLop = () => useQuery({ queryKey: khoa.dsLop(), queryFn: () => api.lop.ds() });

// Tick sáng/chiều, sửa ghi chú, bật/tắt tiền DC: cập nhật giao diện ngay (optimistic),
// lỗi thì trả lại như cũ. Chỉ tải lại dữ liệu sau khi lần bấm cuối cùng xong.
export function useSuaBuoi() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['sua-buoi'],
    mutationFn: ({ id, ...d }: { id: number } & SuaBuoi) => api.buoi.sua(id, d),
    onMutate: async ({ id, ...d }) => {
      await Promise.all([qc.cancelQueries({ queryKey: ['lop', 'ct'] }), qc.cancelQueries({ queryKey: ['buoi'] })]);
      const truoc: [QueryKey, unknown][] = [
        ...qc.getQueriesData({ queryKey: ['lop', 'ct'] }),
        ...qc.getQueriesData({ queryKey: ['buoi'] }),
      ];
      qc.setQueriesData<LopChiTiet>({ queryKey: ['lop', 'ct'] }, (cu) => {
        if (!cu || !cu.buoi.some((b) => b.id === id)) return cu;
        const buoi = cu.buoi.map((b) => (b.id === id ? { ...b, ...d } : b));
        return { ...cu, ...tinhLop(cu, cu.tien_dc_dia_diem, buoi), buoi };
      });
      qc.setQueriesData<BuoiDayDu[]>({ queryKey: ['buoi'] }, (cu) => cu?.map((b) => (b.id === id ? { ...b, ...d } : b)));
      return { truoc };
    },
    onError: (_loi, _bien, ctx) => ctx?.truoc.forEach(([k, v]) => qc.setQueryData(k, v)),
    onSettled: () => {
      if (qc.isMutating({ mutationKey: ['sua-buoi'] }) <= 1) qc.invalidateQueries();
    },
  });
}

export function useThemBuoi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.buoi.tao,
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useXoaBuoi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.buoi.xoa,
    onSuccess: () => qc.invalidateQueries(),
  });
}
