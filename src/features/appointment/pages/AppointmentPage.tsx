/**
 * AppointmentPage — Quản lý lịch hẹn khám.
 *
 * Hiển thị danh sách lịch hẹn theo ngày, bộ lọc theo trạng thái / bác sĩ.
 * Cho phép tạo, xác nhận, ghi nhận đến, huỷ lịch hẹn.
 * Truy cập: receptionist, admin.
 */
import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { appointmentApi } from '@api/appointment.api';
import { useAsync } from '@hooks/useAsync';
import { Button, Field } from '@components/ui';
import type { AppointmentResponse, AppointmentStatus, AppointmentCreate } from '@/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<AppointmentStatus, { label: string; bg: string; color: string }> = {
  scheduled:  { label: '📅 Đã đặt',         bg: '#dbeafe', color: '#1d4ed8' },
  confirmed:  { label: '✅ Đã xác nhận',    bg: '#d1fae5', color: '#065f46' },
  arrived:    { label: '🚶 Đã đến',         bg: '#fef3c7', color: '#92400e' },
  completed:  { label: '🏁 Hoàn tất',       bg: '#f0fdf4', color: '#166534' },
  cancelled:  { label: '❌ Đã huỷ',         bg: '#fee2e2', color: '#991b1b' },
  no_show:    { label: '🚫 Không đến',      bg: '#f1f5f9', color: '#475569' },
};

const TYPE_LABELS: Record<string, string> = {
  new:      '🆕 Khám mới',
  revisit:  '🔄 Tái khám',
  followup: '📋 Follow-up',
};

// ── Create form schema ────────────────────────────────────────────────────────

const createSchema = z.object({
  patient_id:       z.coerce.number().int().positive('Bắt buộc'),
  scheduled_date:   z.string().min(1, 'Bắt buộc'),
  scheduled_time:   z.string().optional(),
  appointment_type: z.enum(['new', 'revisit', 'followup']).default('new'),
  doctor_name:      z.string().optional(),
  department:       z.string().optional(),
  clinic_room:      z.string().optional(),
  reason:           z.string().optional(),
  patient_note:     z.string().optional(),
});
type CreateForm = z.infer<typeof createSchema>;

// ── Component ─────────────────────────────────────────────────────────────────

export default function AppointmentPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [filterStatus, setFilterStatus] = useState<AppointmentStatus | ''>('');
  const [appointments, setAppointments] = useState<AppointmentResponse[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const loadAsync    = useAsync<AppointmentResponse[]>();
  const createAsync  = useAsync<AppointmentResponse>();
  const actionAsync  = useAsync<AppointmentResponse>();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { appointment_type: 'new', scheduled_date: today },
  });

  const load = useCallback(async () => {
    const params: Record<string, string> = { scheduled_date: selectedDate };
    if (filterStatus) params.status = filterStatus;
    const res = await loadAsync.run(
      appointmentApi.list(params as any)
    );
    if (res) setAppointments(res);
  }, [selectedDate, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const onCreate = async (data: CreateForm) => {
    const payload: AppointmentCreate = {
      patient_id:       data.patient_id,
      scheduled_date:   data.scheduled_date,
      scheduled_time:   data.scheduled_time || undefined,
      appointment_type: data.appointment_type,
      doctor_name:      data.doctor_name || undefined,
      department:       data.department || undefined,
      clinic_room:      data.clinic_room || undefined,
      reason:           data.reason || undefined,
      patient_note:     data.patient_note || undefined,
    };
    const res = await createAsync.run(appointmentApi.create(payload));
    if (res) {
      toast.success(`Đã tạo lịch hẹn ${res.appointment_no}`);
      reset(); setShowCreate(false); load();
    } else toast.error(createAsync.error ?? 'Tạo thất bại');
  };

  const handleConfirm = async (id: number) => {
    const res = await actionAsync.run(appointmentApi.confirm(id));
    if (res) { toast.success('Đã xác nhận lịch hẹn'); load(); }
    else toast.error(actionAsync.error ?? 'Thất bại');
  };

  const handleArrive = async (id: number) => {
    const res = await actionAsync.run(appointmentApi.arrive(id));
    if (res) { toast.success('Đã ghi nhận bệnh nhân đến'); load(); }
    else toast.error(actionAsync.error ?? 'Thất bại');
  };

  const handleComplete = async (id: number) => {
    const res = await actionAsync.run(appointmentApi.complete(id));
    if (res) { toast.success('Đã hoàn tất lịch hẹn'); load(); }
    else toast.error(actionAsync.error ?? 'Thất bại');
  };

  const handleCancel = async () => {
    if (!cancelId) return;
    const res = await actionAsync.run(appointmentApi.cancel(cancelId, cancelReason || undefined));
    if (res) {
      toast.success('Đã huỷ lịch hẹn');
      setCancelId(null); setCancelReason(''); load();
    } else toast.error(actionAsync.error ?? 'Thất bại');
  };

  // Stats
  const stats = {
    total:     appointments.length,
    scheduled: appointments.filter(a => a.status === 'scheduled').length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    arrived:   appointments.filter(a => a.status === 'arrived').length,
    completed: appointments.filter(a => a.status === 'completed').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length,
  };

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>📅 Lịch hẹn khám</h1>
          <p className="text-sm text-muted" style={{ margin: '4px 0 0' }}>
            Quản lý lịch hẹn theo ngày
          </p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? '✕ Đóng' : '+ Tạo lịch hẹn'}
        </Button>
      </div>

      {/* ── Create form ─────────────────────────────────────────────────────── */}
      {showCreate && (
        <form onSubmit={handleSubmit(onCreate)}
          style={{ marginBottom: 20, padding: 20, background: 'var(--clr-primary-light)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--clr-primary-dark)' }}>
            📅 Tạo lịch hẹn mới
          </div>

          <div className="form-row form-row-3">
            <Field label="ID Bệnh nhân" required error={errors.patient_id?.message}>
              <input {...register('patient_id')} type="number" className={`form-input${errors.patient_id ? ' error' : ''}`}
                placeholder="Nhập ID bệnh nhân" />
            </Field>
            <Field label="Ngày hẹn" required error={errors.scheduled_date?.message}>
              <input {...register('scheduled_date')} type="date"
                className={`form-input${errors.scheduled_date ? ' error' : ''}`}
                min={today} />
            </Field>
            <Field label="Giờ hẹn">
              <input {...register('scheduled_time')} type="time" className="form-input" />
            </Field>
          </div>

          <div className="form-row form-row-3">
            <Field label="Loại hẹn">
              <select {...register('appointment_type')} className="form-input">
                <option value="new">🆕 Khám mới</option>
                <option value="revisit">🔄 Tái khám</option>
                <option value="followup">📋 Follow-up</option>
              </select>
            </Field>
            <Field label="Bác sĩ">
              <input {...register('doctor_name')} className="form-input" placeholder="Tên bác sĩ..." />
            </Field>
            <Field label="Khoa / Phòng">
              <input {...register('department')} className="form-input" placeholder="Khoa Nội..." />
            </Field>
          </div>

          <div className="form-row form-row-2">
            <Field label="Lý do khám">
              <input {...register('reason')} className="form-input" placeholder="Lý do / triệu chứng..." />
            </Field>
            <Field label="Ghi chú bệnh nhân">
              <input {...register('patient_note')} className="form-input" placeholder="Ghi chú..." />
            </Field>
          </div>

          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={createAsync.loading}>Tạo lịch hẹn</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setShowCreate(false); reset(); }}>Huỷ</Button>
          </div>
        </form>
      )}

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <input type="date" className="form-input" style={{ width: 160 }}
          value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
        <select className="form-input" style={{ width: 200 }}
          value={filterStatus} onChange={e => setFilterStatus(e.target.value as AppointmentStatus | '')}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <Button size="sm" variant="ghost" onClick={load} loading={loadAsync.loading}>
          🔄 Làm mới
        </Button>
      </div>

      {/* ── Stats bar ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Tổng', value: stats.total,     bg: 'var(--clr-gray-100)', color: 'var(--clr-gray-700)' },
          { label: 'Đã đặt', value: stats.scheduled, bg: '#dbeafe', color: '#1d4ed8' },
          { label: 'Xác nhận', value: stats.confirmed, bg: '#d1fae5', color: '#065f46' },
          { label: 'Đã đến', value: stats.arrived,   bg: '#fef3c7', color: '#92400e' },
          { label: 'Hoàn tất', value: stats.completed, bg: '#f0fdf4', color: '#166534' },
          { label: 'Huỷ', value: stats.cancelled,  bg: '#fee2e2', color: '#991b1b' },
        ].map(s => (
          <div key={s.label} style={{
            padding: '8px 14px', background: s.bg, borderRadius: 8, minWidth: 80, textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '.72rem', color: s.color }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Appointment list ─────────────────────────────────────────────────── */}
      {loadAsync.loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--clr-gray-400)' }}>Đang tải...</div>
      ) : appointments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--clr-gray-400)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 8 }}>📅</div>
          <div style={{ fontWeight: 600 }}>Không có lịch hẹn nào</div>
          <div className="text-sm">trong ngày {new Date(selectedDate + 'T00:00:00').toLocaleDateString('vi-VN')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {appointments.map(appt => {
            const st = STATUS_LABELS[appt.status];
            const canConfirm  = appt.status === 'scheduled';
            const canArrive   = appt.status === 'scheduled' || appt.status === 'confirmed';
            const canComplete = appt.status === 'arrived' || appt.status === 'confirmed';
            const canCancel   = appt.status !== 'completed' && appt.status !== 'cancelled';

            return (
              <div key={appt.id} style={{
                background: '#fff', border: '1px solid var(--clr-gray-100)',
                borderRadius: 12, overflow: 'hidden',
              }}>
                <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>

                  {/* Time */}
                  <div style={{
                    minWidth: 64, textAlign: 'center',
                    padding: '8px 12px', background: st.bg, borderRadius: 10,
                  }}>
                    {appt.scheduled_time ? (
                      <div style={{ fontWeight: 800, fontSize: '1.1rem', color: st.color }}>{appt.scheduled_time}</div>
                    ) : (
                      <div style={{ fontSize: '.75rem', color: st.color }}>Chưa có giờ</div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: '.9rem' }}>{appt.appointment_no}</span>
                      <span style={{
                        fontSize: '.72rem', fontWeight: 700, padding: '2px 10px',
                        borderRadius: 999, background: st.bg, color: st.color,
                      }}>{st.label}</span>
                      <span style={{ fontSize: '.75rem', color: 'var(--clr-gray-500)' }}>
                        {TYPE_LABELS[appt.appointment_type] ?? appt.appointment_type}
                      </span>
                    </div>
                    <div className="text-sm" style={{ color: 'var(--clr-gray-700)' }}>
                      BN #{appt.patient_id}
                      {appt.doctor_name && ` • BS: ${appt.doctor_name}`}
                      {appt.department && ` • ${appt.department}`}
                      {appt.clinic_room && ` • P.${appt.clinic_room}`}
                    </div>
                    {appt.reason && (
                      <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                        📋 {appt.reason}
                      </div>
                    )}
                    {appt.cancel_reason && (
                      <div style={{ fontSize: '.75rem', color: '#991b1b', marginTop: 2 }}>
                        Lý do huỷ: {appt.cancel_reason}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {canConfirm && (
                      <Button size="sm" variant="secondary"
                        loading={actionAsync.loading}
                        onClick={() => handleConfirm(appt.id)}>
                        ✅ Xác nhận
                      </Button>
                    )}
                    {canArrive && (
                      <Button size="sm" variant="secondary"
                        loading={actionAsync.loading}
                        onClick={() => handleArrive(appt.id)}>
                        🚶 Đã đến
                      </Button>
                    )}
                    {canComplete && (
                      <Button size="sm"
                        loading={actionAsync.loading}
                        onClick={() => handleComplete(appt.id)}>
                        🏁 Hoàn tất
                      </Button>
                    )}
                    {canCancel && (
                      <Button size="sm" variant="danger"
                        onClick={() => { setCancelId(appt.id); setCancelReason(''); }}>
                        ❌ Huỷ
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Cancel modal ─────────────────────────────────────────────────────── */}
      {cancelId !== null && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 28, width: 420, maxWidth: '90vw',
            boxShadow: '0 25px 50px rgba(0,0,0,.3)',
          }}>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 16 }}>
              ❌ Huỷ lịch hẹn
            </div>
            <Field label="Lý do huỷ (tuỳ chọn)">
              <textarea
                className="form-input" rows={3}
                value={cancelReason}
                placeholder="Bệnh nhân bận, đổi lịch..."
                onChange={e => setCancelReason(e.target.value)}
              />
            </Field>
            <div className="flex gap-2" style={{ marginTop: 16 }}>
              <Button size="sm" variant="danger" loading={actionAsync.loading} onClick={handleCancel}>
                Xác nhận huỷ
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCancelId(null)}>
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
