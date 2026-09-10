import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { receptionApi } from '@api/reception.api';
import { patientApi } from '@api/patient.api';
import { useAsync } from '@hooks/useAsync';
import { Button, Card, Field, LoadingOverlay } from '@components/ui';
import { ROUTES, toPath } from '@/app/routes';
import type { PatientResponse } from '@/types';

const schema = z.object({
  cccd:        z.string().optional(),
  full_name:   z.string().min(2, 'Họ tên tối thiểu 2 ký tự'),
  birth_year:  z.coerce.number().min(1900).max(2100).optional().or(z.literal('')),
  date_of_birth: z.string().optional(),
  gender:      z.enum(['male', 'female', '']).optional(),
  phone:       z.string().optional(),
  weight_kg:   z.coerce.number().positive().optional().or(z.literal('')),
  guardian_name: z.string().optional(),
  clinic_room: z.string().min(1, 'Vui lòng chọn phòng khám'),
  subject_type: z.string().optional(),
  subject_name: z.string().optional(),
  insurance_number: z.string().optional(),
  priority:    z.coerce.number().min(0).max(2).default(0),
  reason:      z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const CLINIC_ROOMS = ['Phòng 1', 'Phòng 2', 'Phòng 3', 'Phòng 4', 'Phòng Tim Mạch', 'Phòng Nhi'];

export default function ReceptionNewPage() {
  const navigate = useNavigate();
  const [patient, setPatient] = useState<PatientResponse | null>(null);
  const searchAsync  = useAsync<PatientResponse>();
  const createAsync  = useAsync<unknown>();

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 0, gender: '' },
  });

  const birthYear     = watch('birth_year');
  const dateOfBirth   = watch('date_of_birth');

  /** Ước tính tuổi tháng từ date_of_birth hoặc birth_year */
  const estimatedAgeMonths = (() => {
    if (dateOfBirth) {
      const dob = new Date(dateOfBirth);
      const now  = new Date();
      return (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
    }
    if (birthYear) {
      return (new Date().getFullYear() - Number(birthYear)) * 12;
    }
    return null;
  })();

  const isUnder72Months = estimatedAgeMonths !== null && estimatedAgeMonths < 72;

  // CCCD lookup
  const handleCccdSearch = async (cccd: string) => {
    if (cccd.length < 9) return;
    const found = await searchAsync.run(patientApi.getByCccd(cccd));
    if (found) {
      setPatient(found);
      setValue('full_name', found.full_name);
      setValue('birth_year', found.birth_year ?? undefined);
      setValue('gender', (found.gender as 'male' | 'female') ?? '');
      setValue('phone', found.phone ?? '');
      toast.success('Đã tìm thấy bệnh nhân trong hệ thống');
    }
  };

  const onSubmit = async (data: FormValues) => {
    const payload = {
      patient_id:   patient?.id ?? undefined,
      patient_data: patient ? undefined : {
        full_name:  data.full_name,
        birth_year: data.birth_year ? Number(data.birth_year) : undefined,
        gender:     data.gender || undefined,
        phone:      data.phone || undefined,
        cccd:       data.cccd || undefined,
        weight_kg:  data.weight_kg ? Number(data.weight_kg) : undefined,
        contact_name: data.guardian_name || undefined,
      },
      clinic_room:      data.clinic_room,
      subject_type:     data.subject_type || undefined,
      subject_name:     data.subject_name || undefined,
      insurance_number: data.insurance_number || undefined,
      priority:         Number(data.priority),
      reason:           data.reason || undefined,
    };

    const res = await createAsync.run(receptionApi.create(payload));
    if (res !== null) {
      toast.success('Đăng ký lượt khám thành công!');
      navigate(toPath(ROUTES.RECEPTION_DETAIL, { id: (res as { id: number }).id }));
    } else {
      toast.error(createAsync.error ?? 'Tạo lượt khám thất bại');
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: 720 }}>
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.RECEPTION)}>← Quay lại</Button>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Đăng ký lượt khám mới</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Patient search */}
        <Card title="Thông tin bệnh nhân">
          {searchAsync.loading && <LoadingOverlay />}
          <div className="form-row form-row-2" style={{ marginBottom: 16 }}>
            <Field label="Số CCCD/CMND">
              <div className="flex gap-2">
                <input
                  {...register('cccd')}
                  className="form-input"
                  placeholder="Nhập CCCD để tìm bệnh nhân cũ"
                  onBlur={e => handleCccdSearch(e.target.value)}
                />
              </div>
            </Field>
            <Field label="Giới tính">
              <select {...register('gender')} className="form-input">
                <option value="">— Chọn —</option>
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
              </select>
            </Field>
          </div>

          <div className="form-row form-row-2">
            <Field label="Họ và tên" required error={errors.full_name?.message}>
              <input {...register('full_name')} className={`form-input${errors.full_name ? ' error' : ''}`} placeholder="Nguyễn Văn A" readOnly={!!patient} />
            </Field>
            <Field label="Năm sinh">
              <input {...register('birth_year')} type="number" className="form-input" placeholder="1990" readOnly={!!patient} />
            </Field>
          </div>

          <div className="form-row form-row-2" style={{ marginTop: 16 }}>
            <Field label="Số điện thoại">
              <input {...register('phone')} className="form-input" placeholder="0912 345 678" />
            </Field>
            <Field label="Ngày sinh (nếu biết chính xác)">
              <input {...register('date_of_birth')} type="date" className="form-input"
                onChange={e => { setValue('date_of_birth', e.target.value); }} />
            </Field>
          </div>

          {/* BYT bắt buộc: cân nặng + guardian nếu BN < 72 tháng */}
          <div className="form-row form-row-2" style={{ marginTop: 16 }}>
            <Field
              label={
                isUnder72Months
                  ? '⚖️ Cân nặng (kg) *'
                  : '⚖️ Cân nặng (kg)'
              }
              error={isUnder72Months && !watch('weight_kg') ? 'Bắt buộc với trẻ < 72 tháng tuổi' : undefined}
            >
              <input
                {...register('weight_kg')}
                type="number" step="0.1" min="0.1" className="form-input"
                placeholder="VD: 14.5"
                style={isUnder72Months ? { borderColor: '#f59e0b' } : {}}
              />
            </Field>
            <Field
              label={
                isUnder72Months
                  ? '👨‍👩‍👧 Tên bố/mẹ/người đưa trẻ *'
                  : '👨‍👩‍👧 Tên bố/mẹ/người đưa trẻ'
              }
              error={isUnder72Months && !watch('guardian_name') ? 'Bắt buộc với trẻ < 72 tháng tuổi' : undefined}
            >
              <input
                {...register('guardian_name')}
                className="form-input"
                placeholder="Họ tên bố/mẹ hoặc người đưa trẻ"
                style={isUnder72Months ? { borderColor: '#f59e0b' } : {}}
              />
            </Field>
          </div>
          {isUnder72Months && (
            <div style={{
              marginTop: 8, padding: '7px 12px',
              background: '#fffbeb', border: '1px solid #fde68a',
              borderRadius: 7, fontSize: '.78rem', color: '#92400e',
            }}>
              ⚠️ Bệnh nhân dưới 72 tháng tuổi — cân nặng và tên người đưa trẻ là bắt buộc theo quy định BYT (đơn thuốc điện tử)
            </div>
          )}
          {!isUnder72Months && estimatedAgeMonths === null && (
            <div style={{ marginTop: 8, fontSize: '.75rem', color: 'var(--clr-gray-400)' }}>
              💡 Nhập ngày sinh để hệ thống tự kiểm tra yêu cầu với trẻ nhỏ
            </div>
          )}

          {patient && (
            <div style={{ paddingTop: 12 }}>
              <span className="badge badge-success">✓ Bệnh nhân đã có trong hệ thống</span>
            </div>
          )}
        </Card>

        {/* Visit info */}
        <Card title="Thông tin lượt khám">
          <div className="form-row form-row-2">
            <Field label="Phòng khám" required error={errors.clinic_room?.message}>
              <select {...register('clinic_room')} className={`form-input${errors.clinic_room ? ' error' : ''}`}>
                <option value="">— Chọn phòng —</option>
                {CLINIC_ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Độ ưu tiên">
              <select {...register('priority')} className="form-input">
                <option value={0}>Bình thường</option>
                <option value={1}>Ưu tiên</option>
                <option value={2}>Cấp cứu</option>
              </select>
            </Field>
          </div>

          <div className="form-row form-row-2" style={{ marginTop: 16 }}>
            <Field label="Đối tượng (mã)">
              <select {...register('subject_type')} className="form-input">
                <option value="">— Chọn —</option>
                <option value="1">BHYT</option>
                <option value="2">Dịch vụ</option>
                <option value="3">Miễn phí</option>
              </select>
            </Field>
            <Field label="Số thẻ BHYT">
              <input {...register('insurance_number')} className="form-input" placeholder="DN4012345678" />
            </Field>
          </div>

          <div style={{ marginTop: 16 }}>
            <Field label="Lý do khám / triệu chứng">
              <textarea {...register('reason')} className="form-input" rows={3} placeholder="Mô tả triệu chứng, lý do đến khám..." />
            </Field>
          </div>
        </Card>

        <div className="flex gap-3" style={{ justifyContent: 'flex-end' }}>
          <Button variant="ghost" type="button" onClick={() => navigate(ROUTES.RECEPTION)}>Huỷ</Button>
          <Button type="submit" loading={createAsync.loading}>Tạo lượt khám</Button>
        </div>
      </form>
    </div>
  );
}
