import { Router } from 'express';
import { buoiRouter } from './buoi.js';
import { caiDatRouter } from './caiDat.js';
import { aiRouter, deThiRouter, mauDeRouter } from './deThi.js';
import { diaDiemRouter } from './diaDiem.js';
import { lopRouter } from './lop.js';
import { cauHoiRouter, monRouter } from './mon.js';
import { nhapRouter } from './nhap.js';
import { saoLuuRouter } from './saoLuu.js';
import { thongKeRouter } from './thongKe.js';
import { truongRouter } from './truong.js';
import { xuatRouter } from './xuat.js';

export const apiRouter = Router();

apiRouter.get('/suc-khoe', (_req, res) => {
  res.json({ ok: true });
});
apiRouter.use('/truong', truongRouter);
apiRouter.use('/dia-diem', diaDiemRouter);
apiRouter.use('/lop', lopRouter);
apiRouter.use('/buoi', buoiRouter);
apiRouter.use('/thong-ke', thongKeRouter);
apiRouter.use('/cai-dat', caiDatRouter);
apiRouter.use('/xuat', xuatRouter);
apiRouter.use('/nhap', nhapRouter);
apiRouter.use('/sao-luu', saoLuuRouter);
apiRouter.use('/mon', monRouter);
apiRouter.use('/cau-hoi', cauHoiRouter);
apiRouter.use('/de-thi', deThiRouter);
apiRouter.use('/mau-de', mauDeRouter);
apiRouter.use('/ai', aiRouter);

// Đường dẫn API không tồn tại
apiRouter.use((_req, res) => {
  res.status(404).json({ loi: 'Không tìm thấy đường dẫn API' });
});
