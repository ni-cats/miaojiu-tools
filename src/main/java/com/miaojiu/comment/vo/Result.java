package com.miaojiu.comment.vo;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 通用返回接口
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Result<T> {

    private String code;       // 状态码
    private String message;    // 返回消息
    private String exception;  // 异常信息（可选）
    private T data;            // 返回数据

    /**
     * 成功返回，带数据
     */
    public static <T> Result<T> success(T data) {
        return new Result<>("200", "操作成功", null, data);
    }

    /**
     * 成功返回，不带数据
     */
    public static <T> Result<T> success() {
        return new Result<>("200", "操作成功", null, null);
    }

    /**
     * 失败返回，带错误码和消息
     */
    public static <T> Result<T> error(String code, String message) {
        return new Result<>(code, message, null, null);
    }

    /**
     * 失败返回，带错误码、消息和异常信息
     */
    public static <T> Result<T> error(String code, String message, String exception) {
        return new Result<>(code, message, exception, null);
    }

    /**
     * 自定义返回
     */
    public static <T> Result<T> custom(String code, String message, String exception, T data) {
        return new Result<>(code, message, exception, data);
    }
}
