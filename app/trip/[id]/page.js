import { supabase } from "../../../lib/supabase";

export default async function TripDetailsPage({ params }) {
  const { id } = params;

  const { data: trip, error } = await supabase
    .from("trips")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !trip) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#f5f7fb",
          padding: "16px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            maxWidth: "520px",
            margin: "0 auto",
            backgroundColor: "#ffffff",
            borderRadius: "22px",
            padding: "20px",
            boxShadow: "0 10px 28px rgba(0,0,0,0.06)",
            border: "1px solid #eef2f7",
            textAlign: "center",
            color: "#6b7280",
          }}
        >
          Рейс не найден
        </div>
      </div>
    );
  }

  const routeName = `${trip.from_city} → ${trip.to_city}`;
  const departureTime = trip.departure_time?.slice(0, 5) || "";
  const duration = trip.travel_duration || "~9 ч";
  const isDepartureDay = trip.trip_date === getTodayString();

  const points = getRoutePoints(trip.from_city, trip.to_city);

  const driverName = isDepartureDay
    ? trip.driver_name || "Данные будут доступны в день отправления"
    : "Данные будут доступны в день отправления";

  const vehicleModel = isDepartureDay
    ? trip.vehicle_model || "Данные будут доступны в день отправления"
    : "Данные будут доступны в день отправления";

  const vehiclePlate = isDepartureDay
    ? trip.vehicle_plate || "Данные будут доступны в день отправления"
    : "Данные будут доступны в день отправления";

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f5f7fb",
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: "520px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          paddingBottom: "30px",
        }}
      >
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "22px",
            padding: "20px",
            boxShadow: "0 10px 28px rgba(0,0,0,0.06)",
            border: "1px solid #eef2f7",
          }}
        >
          <div
            style={{
              fontSize: "24px",
              fontWeight: "800",
              color: "#111827",
              lineHeight: "1.3",
              marginBottom: "10px",
            }}
          >
            {routeName}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
              marginBottom: "14px",
            }}
          >
            <InfoCard
              label="Дата отправления"
              value={formatDateRu(trip.trip_date)}
            />
            <InfoCard label="Время отправления" value={departureTime} />
            <InfoCard label="Время в дороге" value={duration} />
            <InfoCard label="Стоимость" value={`${trip.price} ₽`} />
          </div>

          <div
            style={{
              fontSize: "14px",
              color: "#6b7280",
            }}
          >
            Свободных мест: {trip.seats_available}
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "22px",
            padding: "20px",
            boxShadow: "0 10px 28px rgba(0,0,0,0.06)",
            border: "1px solid #eef2f7",
          }}
        >
          <div
            style={{
              fontSize: "18px",
              fontWeight: "800",
              color: "#111827",
              marginBottom: "14px",
            }}
          >
            Информация о маршрутке
          </div>

          <DetailsRow label="ФИО водителя" value={driverName} />
          <DetailsRow label="Марка маршрутки" value={vehicleModel} />
          <DetailsRow label="Номер маршрутки" value={vehiclePlate} />
        </div>

        <form
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "22px",
            padding: "20px",
            boxShadow: "0 10px 28px rgba(0,0,0,0.06)",
            border: "1px solid #eef2f7",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div
            style={{
              fontSize: "18px",
              fontWeight: "800",
              color: "#111827",
            }}
          >
            Настройки поездки
          </div>

          <div>
            <label style={labelStyle}>Посадка</label>
            <select name="pickup_point" style={inputStyle} defaultValue="">
              <option value="" disabled>
                Выберите точку посадки
              </option>

              <optgroup label="Основная">
                <option value={points.pickup.main}>{points.pickup.main}</option>
              </optgroup>

              <optgroup label="Дополнительные точки">
                {points.pickup.additional.map((point) => (
                  <option key={point} value={point}>
                    {point}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Высадка</label>
            <select name="dropoff_point" style={inputStyle} defaultValue="">
              <option value="" disabled>
                Выберите точку высадки
              </option>

              <optgroup label="Основная">
                <option value={points.dropoff.main}>
                  {points.dropoff.main}
                </option>
              </optgroup>

              <optgroup label="Дополнительные точки">
                {points.dropoff.additional.map((point) => (
                  <option key={point} value={point}>
                    {point}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Сообщение водителю</label>
            <textarea
              name="driver_message"
              placeholder="Например: буду с багажом / буду у дополнительной точки / есть комментарий по поездке"
              style={textareaStyle}
            />
          </div>

          <button
            type="button"
            style={{
              height: "48px",
              border: "none",
              borderRadius: "14px",
              backgroundColor: "#111827",
              color: "#ffffff",
              fontSize: "15px",
              fontWeight: "700",
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(17,24,39,0.18)",
            }}
          >
            Подтвердить бронирование
          </button>
        </form>
      </div>
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div
      style={{
        backgroundColor: "#f8fafc",
        borderRadius: "14px",
        padding: "12px",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          color: "#6b7280",
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "15px",
          fontWeight: "700",
          color: "#111827",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function DetailsRow({ label, value }) {
  return (
    <div
      style={{
        padding: "12px 0",
        borderBottom: "1px solid #eef2f7",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          color: "#6b7280",
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "15px",
          fontWeight: "600",
          color: "#111827",
          lineHeight: "1.4",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function getRoutePoints(fromCity, toCity) {
  if (fromCity === "Санкт-Петербург" && toCity === "Москва") {
    return {
      pickup: {
        main: "м. Московская",
        additional: [
          "Московский вокзал / пл. Восстания",
          "м. Купчино",
          "м. Звёздная",
          "КАД / южный выезд",
        ],
      },
      dropoff: {
        main: "м. Ховрино",
        additional: [
          "м. Речной вокзал",
          "м. Комсомольская",
          "МКАД / северный въезд",
        ],
      },
    };
  }

  return {
    pickup: {
      main: "м. Ховрино",
      additional: [
        "м. Речной вокзал",
        "м. Комсомольская",
        "МКАД / северный въезд",
      ],
    },
    dropoff: {
      main: "м. Московская",
      additional: [
        "Московский вокзал / пл. Восстания",
        "м. Купчино",
        "м. Звёздная",
        "КАД / южный выезд",
      ],
    },
  };
}

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateRu(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("ru-RU");
}

const labelStyle = {
  display: "block",
  fontSize: "14px",
  color: "#374151",
  marginBottom: "6px",
  fontWeight: "600",
};

const inputStyle = {
  width: "100%",
  height: "48px",
  borderRadius: "14px",
  border: "1px solid #d1d5db",
  padding: "0 12px",
  fontSize: "14px",
  backgroundColor: "#ffffff",
  boxSizing: "border-box",
  outline: "none",
};

const textareaStyle = {
  width: "100%",
  minHeight: "110px",
  borderRadius: "14px",
  border: "1px solid #d1d5db",
  padding: "12px",
  fontSize: "14px",
  backgroundColor: "#ffffff",
  boxSizing: "border-box",
  outline: "none",
  resize: "vertical",
};
